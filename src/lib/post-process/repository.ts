import { createSupabaseClient } from '@/lib/supabase'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type {
  CreatePostProcessProductionRecordInput,
  PostProcessProductionHistoryRow,
  PostProcessProductionRecord,
  PostProcessProductionSource,
} from './types'

export type FetchPostProcessCumulativeCountsResult =
  | { ok: true; counts: Record<string, number> }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type CreatePostProcessProductionRecordResult =
  | { ok: true; record: PostProcessProductionRecord; cumulative: number }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type FetchPostProcessProductionHistoryResult =
  | { ok: true; rows: PostProcessProductionHistoryRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export function isMissingPostProcessProductionTable(detail: string) {
  return (
    detail.includes('post_process_production_records') ||
    detail.includes('post_process_production_totals') ||
    detail.includes('schema cache')
  )
}

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

function mapPostProcessProductionRecord(row: {
  id: string
  record_date: string
  assembly_group_id: string
  quantity: number
  source: string
  team?: string | null
  note: string
  created_at: string
}): PostProcessProductionRecord {
  return {
    id: row.id,
    recordDate: String(row.record_date || '').slice(0, 10),
    assemblyGroupId: row.assembly_group_id,
    quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
    source: row.source === 'manual' ? 'manual' : 'manual',
    team: String(row.team ?? '').trim(),
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function fetchPostProcessCumulativeCounts(): Promise<FetchPostProcessCumulativeCountsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('post_process_production_totals')
      .select('assembly_group_id, total_quantity')

    if (error) {
      if (isMissingPostProcessProductionTable(error.message)) {
        return { ok: true, counts: {} }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const counts: Record<string, number> = {}
    for (const row of data || []) {
      const assemblyGroupId = String(row.assembly_group_id || '').trim()
      if (!assemblyGroupId) continue
      counts[assemblyGroupId] = Math.max(0, Math.floor(Number(row.total_quantity) || 0))
    }

    return { ok: true, counts }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createPostProcessProductionRecord(
  input: CreatePostProcessProductionRecordInput,
): Promise<CreatePostProcessProductionRecordResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const assemblyGroupId = String(input.assemblyGroupId || '').trim()
  const quantity = Math.floor(Number(input.quantity) || 0)

  if (!assemblyGroupId) {
    return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
  }
  if (quantity < 1) {
    return { ok: false, reason: 'validation', detail: '등록 수량은 1 이상이어야 합니다.' }
  }

  try {
    const supabase = createSupabaseClient()

    const { data: assemblyGroup, error: groupError } = await supabase
      .from('order_assembly_groups')
      .select('id, target_quantity')
      .eq('id', assemblyGroupId)
      .maybeSingle()

    if (groupError) {
      return { ok: false, reason: 'query', detail: groupError.message }
    }
    if (!assemblyGroup?.id) {
      return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
    }

    const targetQty = Math.max(0, Math.floor(Number(assemblyGroup.target_quantity) || 0))
    const { data: totals, error: totalsError } = await supabase
      .from('post_process_production_totals')
      .select('total_quantity')
      .eq('assembly_group_id', assemblyGroupId)
      .maybeSingle()

    if (totalsError) {
      if (isMissingPostProcessProductionTable(totalsError.message)) {
        return {
          ok: false,
          reason: 'query',
          detail: 'post_process_production_records 테이블이 없습니다. setup-post-process-production.sql 을 실행하세요.',
        }
      }
      return { ok: false, reason: 'query', detail: totalsError.message }
    }

    const currentTotal = Math.max(0, Math.floor(Number(totals?.total_quantity) || 0))
    const remaining = Math.max(0, targetQty - currentTotal)
    if (targetQty > 0 && quantity > remaining) {
      return {
        ok: false,
        reason: 'validation',
        detail: `남은 수량(${remaining.toLocaleString('ko-KR')})을 초과할 수 없습니다.`,
      }
    }

    const recordDate = input.recordDate?.trim() || todayYmdSeoul()
    const source: PostProcessProductionSource = input.source || 'manual'

    const insertPayload = {
      record_date: recordDate,
      assembly_group_id: assemblyGroupId,
      quantity,
      source,
      team: input.team?.trim() || '',
      note: input.note?.trim() || '',
    }

    let { data: inserted, error: insertError } = await supabase
      .from('post_process_production_records')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError?.message.includes('team')) {
      const { team: _team, ...legacyPayload } = insertPayload
      ;({ data: inserted, error: insertError } = await supabase
        .from('post_process_production_records')
        .insert(legacyPayload)
        .select('*')
        .single())
    }

    if (insertError || !inserted) {
      return {
        ok: false,
        reason: 'query',
        detail: insertError?.message || '후공정 생산 기록 저장에 실패했습니다.',
      }
    }

    return {
      ok: true,
      record: mapPostProcessProductionRecord(inserted),
      cumulative: currentTotal + quantity,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

type PostProcessProductionHistoryRecordRow = {
  id: string
  record_date: string
  assembly_group_id: string
  quantity: number
  source: string
  team?: string | null
  note: string
  created_at: string
  order_assembly_groups:
    | {
        target_quantity: number
        parent_product_id: string
        order_id: string
        items:
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null
        orders:
          | { id: string; customer: string }
          | { id: string; customer: string }[]
          | null
      }
    | {
        target_quantity: number
        parent_product_id: string
        order_id: string
        items:
          | { id: string; name: string }
          | { id: string; name: string }[]
          | null
        orders:
          | { id: string; customer: string }
          | { id: string; customer: string }[]
          | null
      }[]
    | null
}

function mapPostProcessProductionHistoryRow(
  row: PostProcessProductionHistoryRecordRow,
): PostProcessProductionHistoryRow | null {
  const assemblyGroups = row.order_assembly_groups
  if (!assemblyGroups) return null

  const assemblyGroup = Array.isArray(assemblyGroups) ? assemblyGroups[0] : assemblyGroups
  if (!assemblyGroup) return null

  const itemRows = assemblyGroup.items
  const product = Array.isArray(itemRows) ? itemRows[0] : itemRows

  const orders = assemblyGroup.orders
  const order = Array.isArray(orders) ? orders[0] : orders
  if (!order) return null

  const record = mapPostProcessProductionRecord(row)

  return {
    id: record.id,
    recordDate: record.recordDate,
    createdAt: record.createdAt,
    orderNumber: order.id || assemblyGroup.order_id || '',
    customer: order.customer || '',
    productName: product?.name || assemblyGroup.parent_product_id || '',
    productCode: product?.id || assemblyGroup.parent_product_id || '',
    targetQuantity: Math.max(0, Math.floor(Number(assemblyGroup.target_quantity) || 0)),
    quantity: record.quantity,
    source: record.source,
    team: record.team,
    note: record.note,
  }
}

export async function fetchPostProcessProductionHistory(): Promise<FetchPostProcessProductionHistoryResult> {
  return fetchPostProcessProductionRecords()
}

export async function fetchPostProcessTodayProduction(): Promise<FetchPostProcessProductionHistoryResult> {
  return fetchPostProcessProductionRecords({ recordDate: todayYmdSeoul() })
}

async function fetchPostProcessProductionRecords(options?: {
  recordDate?: string
  limit?: number
}): Promise<FetchPostProcessProductionHistoryResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const selectWithTeam = `
        id,
        record_date,
        assembly_group_id,
        quantity,
        source,
        team,
        note,
        created_at,
        order_assembly_groups (
          target_quantity,
          parent_product_id,
          order_id,
          items!order_assembly_groups_parent_product_id_fkey (
            id,
            name
          ),
          orders (
            id,
            customer
          )
        )
      `

  const selectWithoutTeam = selectWithTeam.replace('\n        team,\n', '\n')

  try {
    const supabase = createSupabaseClient()

    async function runQuery(includeTeam: boolean) {
      let query = supabase
        .from('post_process_production_records')
        .select(includeTeam ? selectWithTeam : selectWithoutTeam)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 1000)

      if (options?.recordDate) {
        query = query.eq('record_date', options.recordDate)
      }

      return query
    }

    let { data, error } = await runQuery(true)

    if (error?.message.includes('team')) {
      ;({ data, error } = await runQuery(false))
    }

    if (error) {
      if (isMissingPostProcessProductionTable(error.message)) {
        return { ok: true, rows: [] }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const rows: PostProcessProductionHistoryRow[] = []
    for (const row of data || []) {
      const mapped = mapPostProcessProductionHistoryRow(row as unknown as PostProcessProductionHistoryRecordRow)
      if (mapped) rows.push(mapped)
    }

    return { ok: true, rows }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
