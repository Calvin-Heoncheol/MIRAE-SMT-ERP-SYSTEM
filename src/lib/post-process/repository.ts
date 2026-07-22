import { createSupabaseClient } from '@/lib/supabase'
import { resolveCreatedBySnapshot } from '@/lib/auth/created-by'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import type {
  CreatePostProcessProductionRecordInput,
  PostProcessProductionHistoryRow,
  PostProcessProductionRecord,
  PostProcessProductionSource,
} from './types'

export type FetchPostProcessDayPlanProgressResult =
  | { ok: true; progress: Record<string, number> }
  | { ok: false; reason: 'env' | 'query'; detail: string }

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

export function isMissingPostProcessDefectQuantityColumn(detail: string) {
  return (
    detail.includes('defect_quantity') &&
    (detail.includes('column') || detail.includes('schema cache') || detail.includes('Could not find'))
  )
}

export function isPostProcessZeroQuantityConstraintError(detail: string) {
  return (
    detail.includes('post_process_production_records_quantity_check') ||
    detail.includes('post_process_production_records_qty_or_defect_check') ||
    (detail.includes('quantity') && detail.toLowerCase().includes('check'))
  )
}

function schemaErrorDetail(message: string): string | null {
  if (isMissingPostProcessDefectQuantityColumn(message)) {
    return 'post_process_production_records.defect_quantity 컬럼이 없습니다. migrate-post-process-production-records-defect-quantity.sql 을 실행하세요.'
  }
  if (isPostProcessZeroQuantityConstraintError(message)) {
    return '양품 0 등록이 허용되지 않습니다. migrate-post-process-production-records-allow-zero-quantity.sql 을 실행하세요.'
  }
  if (
    (message.includes('created_by') || message.includes('created_by_name')) &&
    (message.includes('column') || message.includes('schema cache') || message.includes('Could not find'))
  ) {
    return 'post_process_production_records.created_by 컬럼이 없습니다. migrate-production-records-created-by.sql 을 실행하세요.'
  }
  return null
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
  defect_quantity?: number | null
  source: string
  team?: string | null
  note: string
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
}): PostProcessProductionRecord {
  return {
    id: row.id,
    recordDate: String(row.record_date || '').slice(0, 10),
    assemblyGroupId: row.assembly_group_id,
    quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
    defectQuantity: Math.max(0, Math.floor(Number(row.defect_quantity) || 0)),
    source: row.source === 'manual' ? 'manual' : 'manual',
    team: String(row.team ?? '').trim(),
    note: row.note || '',
    createdBy: row.created_by ? String(row.created_by) : null,
    createdByName: String(row.created_by_name || '').trim(),
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

export async function fetchPostProcessDayPlanProgress(
  recordDate: string = todayYmdSeoul(),
): Promise<FetchPostProcessDayPlanProgressResult> {
  return fetchPostProcessPlanProgressRange(recordDate, recordDate)
}

/** 기간 내 생산실적을 일자·조립그룹·팀별로 합산 */
export async function fetchPostProcessPlanProgressRange(
  startDate: string,
  endDate: string,
): Promise<FetchPostProcessDayPlanProgressResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const start = startDate.trim()
  const end = endDate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return { ok: false, reason: 'query', detail: '날짜 형식이 올바르지 않습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('post_process_production_records')
      .select('record_date, assembly_group_id, team, quantity')
      .gte('record_date', start)
      .lte('record_date', end)

    if (error) {
      if (isMissingPostProcessProductionTable(error.message)) {
        return { ok: true, progress: {} }
      }
      if (error.message.includes('team')) {
        const legacy = await supabase
          .from('post_process_production_records')
          .select('record_date, assembly_group_id, quantity')
          .gte('record_date', start)
          .lte('record_date', end)
        if (legacy.error) {
          return { ok: false, reason: 'query', detail: legacy.error.message }
        }
        const progress: Record<string, number> = {}
        for (const row of legacy.data || []) {
          const recordDate = String(row.record_date || '').slice(0, 10)
          const assemblyGroupId = String(row.assembly_group_id || '').trim()
          if (!recordDate || !assemblyGroupId) continue
          const key = buildPostProcessPlanProgressKey(assemblyGroupId, recordDate, '생산2팀')
          progress[key] = (progress[key] ?? 0) + Math.max(0, Math.floor(Number(row.quantity) || 0))
        }
        return { ok: true, progress }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const progress: Record<string, number> = {}
    for (const row of data || []) {
      const recordDate = String(row.record_date || '').slice(0, 10)
      const assemblyGroupId = String(row.assembly_group_id || '').trim()
      if (!recordDate || !assemblyGroupId) continue
      const team = String(row.team || '').trim() || '생산2팀'
      const key = buildPostProcessPlanProgressKey(assemblyGroupId, recordDate, team)
      progress[key] = (progress[key] ?? 0) + Math.max(0, Math.floor(Number(row.quantity) || 0))
    }

    return { ok: true, progress }
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
  const quantity = Math.max(0, Math.floor(Number(input.quantity) || 0))
  const defectQuantity = Math.max(0, Math.floor(Number(input.defectQuantity) || 0))

  if (!assemblyGroupId) {
    return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
  }
  if (quantity < 1 && defectQuantity < 1) {
    return { ok: false, reason: 'validation', detail: '수량을 1 이상 입력하세요.' }
  }
  if (quantity > 0 && defectQuantity > 0) {
    return { ok: false, reason: 'validation', detail: '양품과 불량은 한 번에 하나만 등록할 수 있습니다.' }
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
    if (quantity > 0 && targetQty > 0 && quantity > remaining) {
      return {
        ok: false,
        reason: 'validation',
        detail: `남은 수량(${remaining.toLocaleString('ko-KR')})을 초과할 수 없습니다.`,
      }
    }

    const recordDate = input.recordDate?.trim() || todayYmdSeoul()
    const source: PostProcessProductionSource = input.source || 'manual'
    const createdBy = await resolveCreatedBySnapshot()

    const insertPayload = {
      record_date: recordDate,
      assembly_group_id: assemblyGroupId,
      quantity,
      defect_quantity: defectQuantity,
      source,
      team: input.team?.trim() || '',
      note: input.note?.trim() || '',
      created_by: createdBy.createdBy,
      created_by_name: createdBy.createdByName,
    }

    let { data: inserted, error: insertError } = await supabase
      .from('post_process_production_records')
      .insert(insertPayload)
      .select('*')
      .single()

    if (insertError?.message.includes('team')) {
      const { team: _team, ...withoutTeam } = insertPayload
      ;({ data: inserted, error: insertError } = await supabase
        .from('post_process_production_records')
        .insert(withoutTeam)
        .select('*')
        .single())
    }

    if (
      insertError &&
      (insertError.message.includes('created_by') || insertError.message.includes('created_by_name'))
    ) {
      const { created_by: _by, created_by_name: _name, ...withoutCreatedBy } = insertPayload
      ;({ data: inserted, error: insertError } = await supabase
        .from('post_process_production_records')
        .insert(withoutCreatedBy)
        .select('*')
        .single())

      if (insertError?.message.includes('team')) {
        const { team: _team, created_by: _by2, created_by_name: _name2, ...legacy } = insertPayload
        ;({ data: inserted, error: insertError } = await supabase
          .from('post_process_production_records')
          .insert(legacy)
          .select('*')
          .single())
      }
    }

    if (insertError || !inserted) {
      const schemaDetail = insertError?.message ? schemaErrorDetail(insertError.message) : null
      return {
        ok: false,
        reason: 'query',
        detail:
          schemaDetail ||
          insertError?.message ||
          '후공정 생산 기록 저장에 실패했습니다.',
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
  defect_quantity?: number | null
  source: string
  team?: string | null
  note: string
  created_by?: string | null
  created_by_name?: string | null
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
    defectQuantity: record.defectQuantity,
    source: record.source,
    team: record.team,
    note: record.note,
    createdByName: record.createdByName,
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
        defect_quantity,
        source,
        team,
        note,
        created_by,
        created_by_name,
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
  const selectWithoutCreatedBy = selectWithTeam
    .replace('\n        created_by,\n', '\n')
    .replace('\n        created_by_name,\n', '\n')
  const selectLegacy = selectWithoutCreatedBy.replace('\n        team,\n', '\n')

  try {
    const supabase = createSupabaseClient()

    async function runQuery(select: string) {
      let query = supabase
        .from('post_process_production_records')
        .select(select)
        .order('created_at', { ascending: false })
        .limit(options?.limit ?? 1000)

      if (options?.recordDate) {
        query = query.eq('record_date', options.recordDate)
      }

      return query
    }

    let { data, error } = await runQuery(selectWithTeam)

    if (error?.message.includes('team')) {
      ;({ data, error } = await runQuery(selectWithoutTeam))
    }

    if (
      error &&
      (error.message.includes('created_by') || error.message.includes('created_by_name'))
    ) {
      ;({ data, error } = await runQuery(selectWithoutCreatedBy))
      if (error?.message.includes('team')) {
        ;({ data, error } = await runQuery(selectLegacy))
      }
    }

    if (error) {
      if (isMissingPostProcessProductionTable(error.message)) {
        return { ok: true, rows: [] }
      }
      const schemaDetail = schemaErrorDetail(error.message)
      return { ok: false, reason: 'query', detail: schemaDetail || error.message }
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

export type DeletePostProcessProductionRecordResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export async function deletePostProcessProductionRecord(
  recordId: string,
): Promise<DeletePostProcessProductionRecordResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const id = String(recordId || '').trim()
  if (!id) {
    return { ok: false, reason: 'validation', detail: '삭제할 이력을 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('post_process_production_records').delete().eq('id', id)

    if (error) {
      if (isMissingPostProcessProductionTable(error.message)) {
        return {
          ok: false,
          reason: 'query',
          detail: 'post_process_production_records 테이블이 없습니다.',
        }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
