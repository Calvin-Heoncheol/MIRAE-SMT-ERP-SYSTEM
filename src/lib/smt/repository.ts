import { createSupabaseClient } from '@/lib/supabase'
import { todayYmdSeoul } from '@/lib/orders/utils'
import { normalizeProductPcbSideMode } from '@/lib/products/utils'
import { buildSmtCountKey, buildSmtPlanProgressKey, smtPcbSidesForMode } from '@/lib/smt/count-keys'
import type { CreateSmtProductionRecordInput, SmtPcbSide, SmtProductionHistoryRow, SmtProductionRecord } from './types'

export type FetchSmtCumulativeCountsResult =
  | { ok: true; counts: Record<string, number> }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchSmtDayPlanProgressResult =
  | { ok: true; progress: Record<string, number> }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type CreateSmtProductionRecordResult =
  | { ok: true; record: SmtProductionRecord; cumulative: number }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type FetchSmtProductionHistoryResult =
  | { ok: true; rows: SmtProductionHistoryRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchSmtTodayProductionResult = FetchSmtProductionHistoryResult

export function isMissingSmtProductionTable(detail: string) {
  return (
    detail.includes('smt_production_records') ||
    detail.includes('smt_production_totals') ||
    detail.includes('schema cache')
  )
}

export function isMissingSmtDefectQuantityColumn(detail: string) {
  return (
    detail.includes('defect_quantity') &&
    (detail.includes('column') || detail.includes('schema cache') || detail.includes('Could not find'))
  )
}

export function isSmtZeroQuantityConstraintError(detail: string) {
  return (
    detail.includes('smt_production_records_quantity_check') ||
    detail.includes('smt_production_records_qty_or_defect_check') ||
    (detail.includes('quantity') && detail.toLowerCase().includes('check'))
  )
}

function schemaErrorDetail(message: string): string | null {
  if (isMissingSmtDefectQuantityColumn(message)) {
    return 'smt_production_records.defect_quantity 컬럼이 없습니다. migrate-smt-production-records-defect-quantity.sql 을 실행하세요.'
  }
  if (isSmtZeroQuantityConstraintError(message)) {
    return '양품 0 등록이 허용되지 않습니다. migrate-smt-production-records-allow-zero-quantity.sql 을 실행하세요.'
  }
  return null
}

function missingEnvResult(): { ok: false; reason: 'env'; detail: string } {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

function mapSmtProductionRecord(row: {
  id: string
  record_date: string
  order_line_id: string
  line_no: number | null
  pcb_side: string
  quantity: number
  defect_quantity?: number | null
  source: string
  note: string
  created_at: string
}): SmtProductionRecord {
  const pcbSide = String(row.pcb_side || 'SINGLE').toUpperCase()
  const normalizedPcbSide: SmtPcbSide =
    pcbSide === 'TOP' || pcbSide === 'BOT' ? pcbSide : 'SINGLE'

  return {
    id: row.id,
    recordDate: String(row.record_date || '').slice(0, 10),
    orderLineId: row.order_line_id,
    lineNo: row.line_no != null ? Number(row.line_no) : null,
    pcbSide: normalizedPcbSide,
    quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
    defectQuantity: Math.max(0, Math.floor(Number(row.defect_quantity) || 0)),
    source: row.source === 'line_sync' ? 'line_sync' : 'manual',
    note: row.note || '',
    createdAt: row.created_at,
  }
}

export async function fetchSmtCumulativeCounts(): Promise<FetchSmtCumulativeCountsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('smt_production_totals')
      .select('order_line_id, pcb_side, total_quantity')

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const counts: Record<string, number> = {}
    for (const row of data || []) {
      const orderLineId = String(row.order_line_id || '').trim()
      if (!orderLineId) continue
      const pcbSideRaw = String(row.pcb_side || 'SINGLE').toUpperCase()
      const pcbSide: SmtPcbSide =
        pcbSideRaw === 'TOP' || pcbSideRaw === 'BOT' ? pcbSideRaw : 'SINGLE'
      counts[buildSmtCountKey(orderLineId, pcbSide)] = Math.max(
        0,
        Math.floor(Number(row.total_quantity) || 0),
      )
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

/** 특정일 생산실적을 주문라인·면·SMT라인별로 합산 (계획 대비 등록용) */
export async function fetchSmtDayPlanProgress(
  recordDate: string = todayYmdSeoul(),
): Promise<FetchSmtDayPlanProgressResult> {
  return fetchSmtPlanProgressRange(recordDate, recordDate)
}

/** 기간 내 생산실적을 일자·주문라인·면·SMT라인별로 합산 */
export async function fetchSmtPlanProgressRange(
  startDate: string,
  endDate: string,
): Promise<FetchSmtDayPlanProgressResult> {
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
      .from('smt_production_records')
      .select('record_date, order_line_id, line_no, pcb_side, quantity')
      .gte('record_date', start)
      .lte('record_date', end)
      .not('line_no', 'is', null)

    if (error) {
      if (isMissingSmtProductionTable(error.message)) {
        return { ok: true, progress: {} }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const progress: Record<string, number> = {}
    for (const row of data || []) {
      const recordDate = String(row.record_date || '').slice(0, 10)
      const orderLineId = String(row.order_line_id || '').trim()
      const lineNo = Math.floor(Number(row.line_no) || 0)
      if (!recordDate || !orderLineId || lineNo < 1 || lineNo > 7) continue
      const pcbSideRaw = String(row.pcb_side || 'SINGLE').toUpperCase()
      const pcbSide: SmtPcbSide =
        pcbSideRaw === 'TOP' || pcbSideRaw === 'BOT' ? pcbSideRaw : 'SINGLE'
      const key = buildSmtPlanProgressKey(orderLineId, pcbSide, lineNo, recordDate)
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

export async function createSmtProductionRecord(
  input: CreateSmtProductionRecordInput,
): Promise<CreateSmtProductionRecordResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const orderLineId = String(input.orderLineId || '').trim()
  const quantity = Math.max(0, Math.floor(Number(input.quantity) || 0))
  const defectQuantity = Math.max(0, Math.floor(Number(input.defectQuantity) || 0))
  if (!orderLineId) {
    return { ok: false, reason: 'validation', detail: '주문 라인을 찾을 수 없습니다.' }
  }
  if (quantity < 1 && defectQuantity < 1) {
    return { ok: false, reason: 'validation', detail: '수량을 1 이상 입력하세요.' }
  }
  if (quantity > 0 && defectQuantity > 0) {
    return { ok: false, reason: 'validation', detail: '양품과 불량은 한 번에 하나만 등록할 수 있습니다.' }
  }

  try {
    const supabase = createSupabaseClient()

    const { data: orderLine, error: lineError } = await supabase
      .from('order_lines')
      .select('id, quantity, product_id, product_code')
      .eq('id', orderLineId)
      .maybeSingle()

    if (lineError) {
      return { ok: false, reason: 'query', detail: lineError.message }
    }
    if (!orderLine?.id) {
      return { ok: false, reason: 'validation', detail: '주문 라인을 찾을 수 없습니다.' }
    }

    const requestedPcbSide: SmtPcbSide = input.pcbSide || 'SINGLE'
    const itemId = String(orderLine.product_id || orderLine.product_code || '').trim()

    let pcbSideMode = normalizeProductPcbSideMode('single')
    if (itemId) {
      const { data: item, error: itemError } = await supabase
        .from('items')
        .select('pcb_side_mode')
        .eq('id', itemId)
        .maybeSingle()

      if (itemError) {
        return { ok: false, reason: 'query', detail: itemError.message }
      }
      if (item) {
        pcbSideMode = normalizeProductPcbSideMode(item.pcb_side_mode)
      }
    }

    const allowedSides = smtPcbSidesForMode(pcbSideMode)
    if (!allowedSides.includes(requestedPcbSide)) {
      return {
        ok: false,
        reason: 'validation',
        detail:
          pcbSideMode === 'double'
            ? '양면 제품은 TOP 또는 BOT 면으로 등록해 주세요.'
            : '단면·듀얼 제품은 SINGLE로만 등록할 수 있습니다.',
      }
    }

    const targetQty = Math.max(0, Math.floor(Number(orderLine.quantity) || 0))
    const { data: totals, error: totalsError } = await supabase
      .from('smt_production_totals')
      .select('total_quantity')
      .eq('order_line_id', orderLineId)
      .eq('pcb_side', requestedPcbSide)
      .maybeSingle()

    if (totalsError) {
      return { ok: false, reason: 'query', detail: totalsError.message }
    }

    const currentTotal = Math.max(0, Math.floor(Number(totals?.total_quantity) || 0))
    const remaining = Math.max(0, targetQty - currentTotal)
    if (quantity > 0 && targetQty > 0 && quantity > remaining) {
      return {
        ok: false,
        reason: 'validation',
        detail: `${requestedPcbSide} 면 남은 수량(${remaining.toLocaleString('ko-KR')})을 초과할 수 없습니다.`,
      }
    }

    const lineNo = input.lineNo != null ? Math.floor(Number(input.lineNo)) : null
    if (lineNo != null && (lineNo < 1 || lineNo > 7)) {
      return { ok: false, reason: 'validation', detail: 'SMT 라인 번호는 1~7 사이여야 합니다.' }
    }

    const pcbSide = requestedPcbSide
    const recordDate = input.recordDate?.trim() || todayYmdSeoul()

    if (lineNo != null) {
      const { data: plan, error: planError } = await supabase
        .from('smt_production_plans')
        .select('id, planned_quantity')
        .eq('order_line_id', orderLineId)
        .eq('planned_date', recordDate)
        .eq('line_no', lineNo)
        .eq('pcb_side', pcbSide)
        .maybeSingle()

      if (planError) {
        return { ok: false, reason: 'query', detail: planError.message }
      }

      if (plan?.id) {
        const plannedQuantity = Math.max(0, Math.floor(Number(plan.planned_quantity) || 0))
        const { data: planRecords, error: planRecordsError } = await supabase
          .from('smt_production_records')
          .select('quantity')
          .eq('order_line_id', orderLineId)
          .eq('record_date', recordDate)
          .eq('line_no', lineNo)
          .eq('pcb_side', pcbSide)

        if (planRecordsError) {
          return { ok: false, reason: 'query', detail: planRecordsError.message }
        }

        const planProduced = (planRecords || []).reduce(
          (sum, row) => sum + Math.max(0, Math.floor(Number(row.quantity) || 0)),
          0,
        )
        const planRemaining = Math.max(0, plannedQuantity - planProduced)
        if (quantity > 0 && quantity > planRemaining) {
          return {
            ok: false,
            reason: 'validation',
            detail: `계획 남은 수량(${planRemaining.toLocaleString('ko-KR')}/${plannedQuantity.toLocaleString('ko-KR')}대)을 초과할 수 없습니다.`,
          }
        }
      }
    }

    const { data: inserted, error: insertError } = await supabase
      .from('smt_production_records')
      .insert({
        record_date: recordDate,
        order_line_id: orderLineId,
        line_no: lineNo,
        pcb_side: pcbSide,
        quantity,
        defect_quantity: defectQuantity,
        source: input.source || 'manual',
        note: input.note?.trim() || '',
      })
      .select('*')
      .single()

    if (insertError || !inserted) {
      const schemaDetail = insertError?.message ? schemaErrorDetail(insertError.message) : null
      return {
        ok: false,
        reason: 'query',
        detail:
          schemaDetail ||
          insertError?.message ||
          'SMT 생산 기록 저장에 실패했습니다.',
      }
    }

    return {
      ok: true,
      record: mapSmtProductionRecord(inserted),
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

type SmtProductionHistoryRecordRow = {
  id: string
  record_date: string
  order_line_id: string
  line_no: number | null
  pcb_side: string
  quantity: number
  defect_quantity?: number | null
  source: string
  note: string
  created_at: string
  order_lines:
    | {
        product_code: string
        product_name: string
        quantity: number
        orders:
          | {
              id: string
              customer: string
            }
          | {
              id: string
              customer: string
            }[]
          | null
      }
    | {
        product_code: string
        product_name: string
        quantity: number
        orders:
          | {
              id: string
              customer: string
            }
          | {
              id: string
              customer: string
            }[]
          | null
      }[]
    | null
}

function resolveNestedOrderLine(row: SmtProductionHistoryRecordRow) {
  const orderLines = row.order_lines
  if (!orderLines) return null
  const orderLine = Array.isArray(orderLines) ? orderLines[0] : orderLines
  if (!orderLine) return null

  const orders = orderLine.orders
  const order = Array.isArray(orders) ? orders[0] : orders
  if (!order) return null

  return { orderLine, order }
}

function mapSmtProductionHistoryRow(row: SmtProductionHistoryRecordRow): SmtProductionHistoryRow | null {
  const resolved = resolveNestedOrderLine(row)
  if (!resolved) return null

  const { orderLine, order } = resolved
  const record = mapSmtProductionRecord(row)

  return {
    id: record.id,
    recordDate: record.recordDate,
    createdAt: record.createdAt,
    orderNumber: order.id || '',
    customer: order.customer || '',
    productName: orderLine.product_name || '',
    productCode: orderLine.product_code || '',
    orderQuantity: Math.max(0, Math.floor(Number(orderLine.quantity) || 0)),
    quantity: record.quantity,
    defectQuantity: record.defectQuantity,
    lineNo: record.lineNo,
    pcbSide: record.pcbSide,
    source: record.source,
    note: record.note,
  }
}

export async function fetchSmtProductionHistory(): Promise<FetchSmtProductionHistoryResult> {
  return fetchSmtProductionRecords()
}

export async function fetchSmtTodayProduction(): Promise<FetchSmtTodayProductionResult> {
  return fetchSmtProductionRecords({ recordDate: todayYmdSeoul() })
}

async function fetchSmtProductionRecords(options?: {
  recordDate?: string
  limit?: number
}): Promise<FetchSmtProductionHistoryResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    let query = supabase
      .from('smt_production_records')
      .select(
        `
        id,
        record_date,
        order_line_id,
        line_no,
        pcb_side,
        quantity,
        defect_quantity,
        source,
        note,
        created_at,
        order_lines (
          product_code,
          product_name,
          quantity,
          orders (
            id,
            customer
          )
        )
      `,
      )
      .order('created_at', { ascending: false })
      .limit(options?.limit ?? 1000)

    if (options?.recordDate) {
      query = query.eq('record_date', options.recordDate)
    }

    const { data, error } = await query

    if (error) {
      const schemaDetail = schemaErrorDetail(error.message)
      return { ok: false, reason: 'query', detail: schemaDetail || error.message }
    }

    const rows: SmtProductionHistoryRow[] = []
    for (const row of data || []) {
      const mapped = mapSmtProductionHistoryRow(row as SmtProductionHistoryRecordRow)
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

export type DeleteSmtProductionRecordResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export async function deleteSmtProductionRecord(
  recordId: string,
): Promise<DeleteSmtProductionRecordResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const id = String(recordId || '').trim()
  if (!id) {
    return { ok: false, reason: 'validation', detail: '삭제할 이력을 찾을 수 없습니다.' }
  }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('smt_production_records').delete().eq('id', id)

    if (error) {
      if (isMissingSmtProductionTable(error.message)) {
        return {
          ok: false,
          reason: 'query',
          detail: 'smt_production_records 테이블이 없습니다.',
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
