import type { ProductProcessType } from '@/lib/products/types'
import { processTypeIncludesPostProcess, processTypeIncludesSmt } from '@/lib/quotes/production-flags'
import { isSplitProductPcbSideMode, normalizeProductPcbSideMode } from '@/lib/products/utils'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import { normalizeSmtPlanPcbSide } from '@/lib/smt/plan/utils'
import { createSupabaseClient } from '@/lib/supabase'
import { todayYmdSeoul } from '@/lib/orders/utils'
import type { LotAllocation, LotSyncResult, ProductionLot } from './types'
import { allocateLotsFifo, formatLotIdsLabel, isMissingProductionLotsTable } from './utils'

function missingEnvResult(): LotSyncResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

function mapLot(row: {
  id: string
  lot_date: string
  assembly_group_id: string
  product_code?: string | null
  product_name?: string | null
  order_id?: string | null
  quantity: number
  source?: string | null
  shipped?: number
}): ProductionLot {
  const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0))
  const shippedQuantity = Math.max(0, Math.floor(Number(row.shipped) || 0))
  return {
    id: String(row.id),
    lotDate: String(row.lot_date || '').slice(0, 10),
    assemblyGroupId: String(row.assembly_group_id),
    productCode: String(row.product_code || '').trim(),
    productName: String(row.product_name || '').trim(),
    orderId: String(row.order_id || '').trim(),
    quantity,
    shippedQuantity,
    remaining: Math.max(0, quantity - shippedQuantity),
    source: String(row.source || '').trim() || 'production',
  }
}

async function generateLotId(lotDate: string): Promise<string> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase.rpc('generate_production_lot_number', {
    p_lot_date: lotDate,
  })
  if (!error && data) return String(data)

  const prefix = `LOT-${lotDate.slice(2, 4)}${lotDate.slice(5, 7)}${lotDate.slice(8, 10)}`
  const { data: rows } = await supabase.from('production_lots').select('id').like('id', `${prefix}-%`)
  let maxSuffix = 0
  for (const row of rows || []) {
    const suffix = Number(String(row.id).slice(prefix.length + 1))
    if (Number.isFinite(suffix) && suffix > maxSuffix) maxSuffix = suffix
  }
  return `${prefix}-${String(maxSuffix + 1).padStart(2, '0')}`
}

async function loadGroupSnapshot(assemblyGroupId: string) {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('order_assembly_groups')
    .select(
      'id, order_id, parent_product_id, items!order_assembly_groups_parent_product_id_fkey(id, name, process_type, item_category), order_assembly_group_lines(order_line_id, child_product_id, quantity_per)',
    )
    .eq('id', assemblyGroupId)
    .maybeSingle()

  if (error) return { ok: false as const, detail: error.message }
  if (!data?.id) return { ok: false as const, detail: '조립 그룹을 찾을 수 없습니다.' }

  const item = Array.isArray(data.items) ? data.items[0] : data.items
  const lines = (data.order_assembly_group_lines || []) as Array<{
    order_line_id?: string
    child_product_id?: string
    quantity_per?: number
  }>

  return {
    ok: true as const,
    orderId: String(data.order_id || ''),
    parentProductId: String(data.parent_product_id || ''),
    productCode: String(item?.id || data.parent_product_id || ''),
    productName: String(item?.name || ''),
    processType: item?.process_type,
    /** 4=조립제품, 그 외(3 등)=반제품 */
    isAssembly: Number(item?.item_category) === 4,
    lines: lines.map((line) => ({
      orderLineId: String(line.order_line_id || ''),
      childProductId: String(line.child_product_id || ''),
      quantityPer: Math.max(1, Math.floor(Number(line.quantity_per) || 1)),
    })),
  }
}

async function computeSmtSetsForGroup(lines: Array<{ orderLineId: string; childProductId: string; quantityPer: number }>) {
  if (!lines.length) return 0
  const supabase = createSupabaseClient()
  const childIds = [...new Set(lines.map((line) => line.childProductId).filter(Boolean))]
  const lineIds = [...new Set(lines.map((line) => line.orderLineId).filter(Boolean))]
  if (!lineIds.length) return 0

  const [{ data: items }, { data: totals }] = await Promise.all([
    childIds.length
      ? supabase.from('items').select('id, process_type, pcb_side_mode').in('id', childIds)
      : Promise.resolve({ data: [] as Array<{ id: string; process_type?: string | null; pcb_side_mode?: string | null }> }),
    supabase
      .from('smt_production_totals')
      .select('order_line_id, pcb_side, total_quantity')
      .in('order_line_id', lineIds),
  ])

  const itemById = new Map(
    (items || []).map((item) => [
      String(item.id),
      {
        processType: item.process_type,
        pcbSideMode: normalizeProductPcbSideMode(item.pcb_side_mode),
      },
    ]),
  )
  const countMap: Record<string, number> = {}
  for (const row of totals || []) {
    countMap[buildSmtCountKey(String(row.order_line_id), normalizeSmtPlanPcbSide(String(row.pcb_side)))] =
      Math.max(0, Math.floor(Number(row.total_quantity) || 0))
  }

  let minSets = Number.POSITIVE_INFINITY
  let counted = 0
  for (const line of lines) {
    const item = itemById.get(line.childProductId)
    if (!processTypeIncludesSmt(item?.processType as ProductProcessType)) continue
    const pcbSideMode = item?.pcbSideMode ?? 'single'
    const produced = isSplitProductPcbSideMode(pcbSideMode)
      ? Math.min(
          countMap[buildSmtCountKey(line.orderLineId, 'TOP')] || 0,
          countMap[buildSmtCountKey(line.orderLineId, 'BOT')] || 0,
        )
      : countMap[buildSmtCountKey(line.orderLineId, 'SINGLE')] || 0
    minSets = Math.min(minSets, Math.floor(produced / line.quantityPer))
    counted += 1
  }
  if (!counted || !Number.isFinite(minSets)) return 0
  return Math.max(0, minSets)
}

async function fetchLotsWithShipped(
  assemblyGroupId: string,
  options: { excludeDeliveryRecordId?: string } = {},
): Promise<
  | { ok: true; lots: ProductionLot[] }
  | { ok: false; reason: 'query'; detail: string }
> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('production_lots')
    .select('id, lot_date, assembly_group_id, product_code, product_name, order_id, quantity, source')
    .eq('assembly_group_id', assemblyGroupId)
    .order('lot_date', { ascending: true })
    .order('id', { ascending: true })

  if (error) {
    return { ok: false, reason: 'query', detail: error.message }
  }

  const lots = (data || []).map((row) => mapLot(row))
  if (!lots.length) return { ok: true, lots }

  const { data: shippedRows, error: shippedError } = await supabase
    .from('delivery_record_lots')
    .select('delivery_record_id, lot_id, quantity')
    .in(
      'lot_id',
      lots.map((lot) => lot.id),
    )

  if (shippedError) {
    if (isMissingProductionLotsTable(shippedError.message)) return { ok: true, lots }
    return { ok: false, reason: 'query', detail: shippedError.message }
  }

  const excludeId = String(options.excludeDeliveryRecordId || '').trim()
  const shippedByLot = new Map<string, number>()
  for (const row of shippedRows || []) {
    if (excludeId && String(row.delivery_record_id || '').trim() === excludeId) continue
    const lotId = String(row.lot_id)
    shippedByLot.set(lotId, (shippedByLot.get(lotId) || 0) + Math.max(0, Math.floor(Number(row.quantity) || 0)))
  }

  return {
    ok: true,
    lots: lots.map((lot) => {
      const shippedQuantity = shippedByLot.get(lot.id) || 0
      return {
        ...lot,
        shippedQuantity,
        remaining: Math.max(0, lot.quantity - shippedQuantity),
      }
    }),
  }
}

async function incrementLot(input: {
  assemblyGroupId: string
  lotDate: string
  quantity: number
  snapshot: {
    orderId: string
    productCode: string
    productName: string
  }
  source?: string
}): Promise<LotSyncResult> {
  const supabase = createSupabaseClient()
  const { data: existing, error: existingError } = await supabase
    .from('production_lots')
    .select('id, quantity')
    .eq('assembly_group_id', input.assemblyGroupId)
    .eq('lot_date', input.lotDate)
    .maybeSingle()

  if (existingError) return { ok: false, reason: 'query', detail: existingError.message }

  if (existing?.id) {
    const nextQty = Math.max(0, Math.floor(Number(existing.quantity) || 0)) + input.quantity
    const { error } = await supabase.from('production_lots').update({ quantity: nextQty }).eq('id', existing.id)
    if (error) return { ok: false, reason: 'query', detail: error.message }
    return { ok: true }
  }

  const id = await generateLotId(input.lotDate)
  const { error } = await supabase.from('production_lots').insert({
    id,
    lot_date: input.lotDate,
    assembly_group_id: input.assemblyGroupId,
    product_code: input.snapshot.productCode,
    product_name: input.snapshot.productName,
    order_id: input.snapshot.orderId,
    quantity: input.quantity,
    source: input.source || 'production',
  })
  if (error) return { ok: false, reason: 'query', detail: error.message }
  return { ok: true }
}

async function reduceLots(lots: ProductionLot[], quantity: number): Promise<LotSyncResult> {
  const supabase = createSupabaseClient()
  let remaining = Math.max(0, Math.floor(Number(quantity) || 0))
  const newestFirst = [...lots].sort((a, b) => {
    const byDate = b.lotDate.localeCompare(a.lotDate)
    if (byDate !== 0) return byDate
    return b.id.localeCompare(a.id)
  })

  for (const lot of newestFirst) {
    if (remaining <= 0) break
    const free = Math.max(0, lot.quantity - lot.shippedQuantity)
    const take = Math.min(free, remaining)
    if (take < 1) continue
    const nextQty = lot.quantity - take
    if (nextQty <= 0 && lot.shippedQuantity <= 0) {
      const { error } = await supabase.from('production_lots').delete().eq('id', lot.id)
      if (error) return { ok: false, reason: 'query', detail: error.message }
    } else {
      const { error } = await supabase.from('production_lots').update({ quantity: nextQty }).eq('id', lot.id)
      if (error) return { ok: false, reason: 'query', detail: error.message }
    }
    remaining -= take
  }

  if (remaining > 0) {
    return {
      ok: false,
      reason: 'validation',
      detail: '이미 출하된 LOT 수량보다 생산이력이 적어 줄일 수 없습니다.',
    }
  }
  return { ok: true }
}

export async function syncFinishedGoodsLots(input: {
  assemblyGroupId: string
  preferDate?: string
}): Promise<LotSyncResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const assemblyGroupId = String(input.assemblyGroupId || '').trim()
  const preferDate = String(input.preferDate || todayYmdSeoul()).slice(0, 10)
  if (!assemblyGroupId) {
    return { ok: false, reason: 'validation', detail: '조립 그룹을 찾을 수 없습니다.' }
  }

  try {
    const snapshot = await loadGroupSnapshot(assemblyGroupId)
    if (!snapshot.ok) return { ok: false, reason: 'query', detail: snapshot.detail }

    const supabase = createSupabaseClient()
    const needsPost = processTypeIncludesPostProcess(snapshot.processType as ProductProcessType)
    const isSemiFinished = !snapshot.isAssembly
    let produced = 0

    if (needsPost && !isSemiFinished) {
      // 조립제품: 후공정 완료 기준 LOT
      const { data, error } = await supabase
        .from('post_process_production_records')
        .select('quantity')
        .eq('assembly_group_id', assemblyGroupId)
      if (error) return { ok: false, reason: 'query', detail: error.message }
      produced = (data || []).reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.quantity) || 0)), 0)
    } else if (needsPost && isSemiFinished) {
      // 반제품: 후공정이 있어도 SMT 기준으로 LOT (반제품 출고). 후공정만 있으면 후공정.
      const smtSets = await computeSmtSetsForGroup(snapshot.lines)
      if (processTypeIncludesSmt(snapshot.processType as ProductProcessType) || smtSets > 0) {
        produced = smtSets
      } else {
        const { data, error } = await supabase
          .from('post_process_production_records')
          .select('quantity')
          .eq('assembly_group_id', assemblyGroupId)
        if (error) return { ok: false, reason: 'query', detail: error.message }
        produced = (data || []).reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.quantity) || 0)), 0)
      }
    } else {
      produced = await computeSmtSetsForGroup(snapshot.lines)
    }

    const lotsResult = await fetchLotsWithShipped(assemblyGroupId)
    if (!lotsResult.ok) {
      if (isMissingProductionLotsTable(lotsResult.detail)) return { ok: true }
      return lotsResult
    }

    const lotTotal = lotsResult.lots.reduce((sum, lot) => sum + lot.quantity, 0)

    if (!lotsResult.lots.length && produced > 0) {
      return incrementLot({
        assemblyGroupId,
        lotDate: preferDate,
        quantity: produced,
        snapshot,
      })
    }

    const delta = produced - lotTotal
    if (delta === 0) return { ok: true }
    if (delta > 0) {
      return incrementLot({
        assemblyGroupId,
        lotDate: preferDate,
        quantity: delta,
        snapshot,
      })
    }
    return reduceLots(lotsResult.lots, -delta)
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (isMissingProductionLotsTable(detail)) return { ok: true }
    return { ok: false, reason: 'query', detail }
  }
}

export async function syncLotsForSmtOrderLine(input: {
  orderLineId: string
  preferDate?: string
}): Promise<LotSyncResult> {
  const orderLineId = String(input.orderLineId || '').trim()
  if (!orderLineId) return { ok: true }

  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('order_assembly_group_lines')
    .select('assembly_group_id')
    .eq('order_line_id', orderLineId)

  if (error) {
    if (isMissingProductionLotsTable(error.message)) return { ok: true }
    return { ok: false, reason: 'query', detail: error.message }
  }

  for (const row of data || []) {
    const assemblyGroupId = String(row.assembly_group_id || '').trim()
    if (!assemblyGroupId) continue
    const snapshot = await loadGroupSnapshot(assemblyGroupId)
    if (!snapshot.ok) continue
    // 조립제품+후공정: SMT만으로는 LOT 안 만듦. 반제품은 SMT에서도 LOT 생성.
    if (
      processTypeIncludesPostProcess(snapshot.processType as ProductProcessType) &&
      snapshot.isAssembly
    ) {
      continue
    }
    const result = await syncFinishedGoodsLots({
      assemblyGroupId,
      preferDate: input.preferDate,
    })
    if (!result.ok && result.reason === 'validation') return result
  }
  return { ok: true }
}

export async function fetchAvailableLots(assemblyGroupId: string): Promise<
  | { ok: true; lots: ProductionLot[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }
> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }
  const id = String(assemblyGroupId || '').trim()
  if (!id) return { ok: true, lots: [] }

  try {
    const result = await fetchLotsWithShipped(id)
    if (!result.ok) {
      if (isMissingProductionLotsTable(result.detail)) return { ok: true, lots: [] }
      return result
    }
    return { ok: true, lots: result.lots.filter((lot) => lot.remaining > 0) }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (isMissingProductionLotsTable(detail)) return { ok: true, lots: [] }
    return { ok: false, reason: 'query', detail }
  }
}

export async function prepareLotAllocations(input: {
  assemblyGroupId: string
  quantity: number
  preferDate?: string
  allocations?: LotAllocation[]
  /** 출하 수정 시 — 해당 출하 기록의 기존 LOT 배정을 잔량에 다시 포함 */
  excludeDeliveryRecordId?: string
}): Promise<
  | { ok: true; allocations: LotAllocation[]; usedCatchUp?: boolean }
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }
> {
  const quantity = Math.max(0, Math.floor(Number(input.quantity) || 0))
  if (quantity < 1) return { ok: true, allocations: [] }

  const sync = await syncFinishedGoodsLots({
    assemblyGroupId: input.assemblyGroupId,
    preferDate: input.preferDate,
  })
  if (!sync.ok && sync.reason === 'validation') return sync

  const excludeDeliveryRecordId = String(input.excludeDeliveryRecordId || '').trim() || undefined

  async function loadAvailable() {
    if (excludeDeliveryRecordId) {
      const withShipped = await fetchLotsWithShipped(input.assemblyGroupId, { excludeDeliveryRecordId })
      if (!withShipped.ok) return withShipped
      return {
        ok: true as const,
        lots: withShipped.lots.filter((lot) => lot.remaining > 0),
      }
    }
    return fetchAvailableLots(input.assemblyGroupId)
  }

  let available = await loadAvailable()
  if (!available.ok) return available

  let usedCatchUp = false
  const remaining = available.lots.reduce((sum, lot) => sum + lot.remaining, 0)
  if (remaining < quantity) {
    const snapshot = await loadGroupSnapshot(input.assemblyGroupId)
    if (snapshot.ok) {
      const catchUp = await incrementLot({
        assemblyGroupId: input.assemblyGroupId,
        lotDate: String(input.preferDate || todayYmdSeoul()).slice(0, 10),
        quantity: quantity - remaining,
        snapshot,
        source: 'catch_up',
      })
      if (catchUp.ok) {
        usedCatchUp = true
        const refreshed = await loadAvailable()
        if (refreshed.ok) available = refreshed
      }
    }
  }

  if (!available.ok) return available

  const requested = (input.allocations || []).filter((line) => Math.floor(Number(line.quantity) || 0) > 0)
  if (requested.length) {
    const remainingByLot = new Map(available.lots.map((lot) => [lot.id, lot.remaining]))
    let sum = 0
    for (const line of requested) {
      const qty = Math.max(0, Math.floor(Number(line.quantity) || 0))
      sum += qty
      const left = remainingByLot.get(line.lotId) ?? 0
      if (qty > left) {
        return {
          ok: false,
          reason: 'validation',
          detail: `${line.lotId} 잔량(${left.toLocaleString('ko-KR')})을 초과했습니다.`,
        }
      }
    }
    if (sum !== quantity) {
      return {
        ok: false,
        reason: 'validation',
        detail: `LOT 배정 합계(${sum.toLocaleString('ko-KR')})가 출하 수량과 다릅니다.`,
      }
    }
    return {
      ok: true,
      usedCatchUp,
      allocations: requested.map((line) => ({
        ...line,
        quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
        remaining: remainingByLot.get(line.lotId) ?? line.remaining,
      })),
    }
  }

  const allocations = allocateLotsFifo(available.lots, quantity)
  const allocated = allocations.reduce((sum, line) => sum + line.quantity, 0)
  if (allocated < quantity) {
    return {
      ok: false,
      reason: 'validation',
      detail: `배정할 LOT 잔량이 부족합니다. (필요 ${quantity.toLocaleString('ko-KR')})`,
    }
  }
  return { ok: true, allocations, usedCatchUp }
}

export async function persistDeliveryRecordLots(input: {
  deliveryRecordId: string
  assemblyGroupId: string
  quantity: number
  preferDate?: string
  allocations?: LotAllocation[]
  excludeDeliveryRecordId?: string
}): Promise<LotSyncResult> {
  const prepared = await prepareLotAllocations({
    assemblyGroupId: input.assemblyGroupId,
    quantity: input.quantity,
    preferDate: input.preferDate,
    allocations: input.allocations,
    excludeDeliveryRecordId: input.excludeDeliveryRecordId,
  })
  if (!prepared.ok) {
    if (prepared.reason === 'env' || isMissingProductionLotsTable(prepared.detail)) {
      return { ok: true }
    }
    return prepared
  }
  const saved = await saveDeliveryRecordLots({
    deliveryRecordId: input.deliveryRecordId,
    allocations: prepared.allocations,
  })
  if (!saved.ok) return saved
  return { ok: true, usedCatchUp: prepared.usedCatchUp }
}

/** 출하 수량 변경 시 기존 LOT 배정을 지우고 FIFO(또는 지정)로 다시 배정 */
export async function replaceDeliveryRecordLots(input: {
  deliveryRecordId: string
  assemblyGroupId: string
  quantity: number
  preferDate?: string
  allocations?: LotAllocation[]
}): Promise<LotSyncResult> {
  const deliveryRecordId = String(input.deliveryRecordId || '').trim()
  const assemblyGroupId = String(input.assemblyGroupId || '').trim()
  if (!deliveryRecordId || !assemblyGroupId) return { ok: true }

  try {
    const supabase = createSupabaseClient()
    const { data: existingLinks, error: existingError } = await supabase
      .from('delivery_record_lots')
      .select('lot_id, quantity')
      .eq('delivery_record_id', deliveryRecordId)

    if (existingError) {
      if (isMissingProductionLotsTable(existingError.message)) return { ok: true }
      return { ok: false, reason: 'query', detail: existingError.message }
    }

    const prepared = await prepareLotAllocations({
      assemblyGroupId,
      quantity: input.quantity,
      preferDate: input.preferDate,
      allocations: input.allocations,
      excludeDeliveryRecordId: deliveryRecordId,
    })
    if (!prepared.ok) {
      if (prepared.reason === 'env' || isMissingProductionLotsTable(prepared.detail)) {
        return { ok: true }
      }
      return prepared
    }

    const { error: deleteError } = await supabase
      .from('delivery_record_lots')
      .delete()
      .eq('delivery_record_id', deliveryRecordId)

    if (deleteError) {
      if (isMissingProductionLotsTable(deleteError.message)) return { ok: true }
      return { ok: false, reason: 'query', detail: deleteError.message }
    }

    const saved = await saveDeliveryRecordLots({
      deliveryRecordId,
      allocations: prepared.allocations,
    })
    if (!saved.ok) {
      const restoreRows = (existingLinks || [])
        .map((row) => ({
          delivery_record_id: deliveryRecordId,
          lot_id: String(row.lot_id || '').trim(),
          quantity: Math.max(0, Math.floor(Number(row.quantity) || 0)),
        }))
        .filter((row) => row.lot_id && row.quantity > 0)
      if (restoreRows.length) {
        await supabase.from('delivery_record_lots').insert(restoreRows)
      }
      return saved
    }

    return { ok: true, usedCatchUp: prepared.usedCatchUp }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (isMissingProductionLotsTable(detail)) return { ok: true }
    return { ok: false, reason: 'query', detail }
  }
}

export async function saveDeliveryRecordLots(input: {
  deliveryRecordId: string
  allocations: LotAllocation[]
}): Promise<LotSyncResult> {
  const deliveryRecordId = String(input.deliveryRecordId || '').trim()
  const rows = (input.allocations || [])
    .map((line) => ({
      delivery_record_id: deliveryRecordId,
      lot_id: String(line.lotId || '').trim(),
      quantity: Math.max(0, Math.floor(Number(line.quantity) || 0)),
    }))
    .filter((row) => row.lot_id && row.quantity > 0)

  if (!deliveryRecordId || !rows.length) return { ok: true }

  try {
    const supabase = createSupabaseClient()
    const { error } = await supabase.from('delivery_record_lots').insert(rows)
    if (error) {
      if (isMissingProductionLotsTable(error.message)) return { ok: true }
      return { ok: false, reason: 'query', detail: error.message }
    }
    return { ok: true }
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (isMissingProductionLotsTable(detail)) return { ok: true }
    return { ok: false, reason: 'query', detail }
  }
}

export type ProductionLotSearchIndex = {
  lotsByGroupDate: Record<string, string[]>
  lotsByGroup: Record<string, string[]>
  groupIdsByOrderLineId: Record<string, string[]>
  lotsByOrderDate: Record<string, string[]>
  lotsByProductDate: Record<string, string[]>
}

export function emptyProductionLotSearchIndex(): ProductionLotSearchIndex {
  return {
    lotsByGroupDate: {},
    lotsByGroup: {},
    groupIdsByOrderLineId: {},
    lotsByOrderDate: {},
    lotsByProductDate: {},
  }
}

function pushUniqueLot(map: Record<string, string[]>, key: string, value: string) {
  if (!key || !value) return
  const list = map[key] || (map[key] = [])
  if (!list.includes(value)) list.push(value)
}

export async function fetchProductionLotSearchIndex(): Promise<ProductionLotSearchIndex> {
  const empty = emptyProductionLotSearchIndex()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return empty
  }

  try {
    const supabase = createSupabaseClient()
    const [{ data: lots, error: lotsError }, { data: lines, error: linesError }] = await Promise.all([
      supabase
        .from('production_lots')
        .select('id, lot_date, assembly_group_id, product_code, order_id')
        .limit(20000),
      supabase.from('order_assembly_group_lines').select('assembly_group_id, order_line_id').limit(20000),
    ])

    if (lotsError) {
      if (isMissingProductionLotsTable(lotsError.message)) return empty
      return empty
    }

    const index = emptyProductionLotSearchIndex()
    for (const row of lots || []) {
      const id = String(row.id || '').trim()
      const date = String(row.lot_date || '').slice(0, 10)
      const groupId = String(row.assembly_group_id || '').trim()
      const productCode = String(row.product_code || '').trim()
      const orderId = String(row.order_id || '').trim()
      if (!id) continue
      if (groupId && date) pushUniqueLot(index.lotsByGroupDate, `${groupId}|${date}`, id)
      if (groupId) pushUniqueLot(index.lotsByGroup, groupId, id)
      if (orderId && date) pushUniqueLot(index.lotsByOrderDate, `${orderId}|${date}`, id)
      if (productCode && date) pushUniqueLot(index.lotsByProductDate, `${productCode}|${date}`, id)
    }

    if (!linesError) {
      for (const row of lines || []) {
        pushUniqueLot(
          index.groupIdsByOrderLineId,
          String(row.order_line_id || '').trim(),
          String(row.assembly_group_id || '').trim(),
        )
      }
    }

    return index
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (isMissingProductionLotsTable(detail)) return empty
    return empty
  }
}

export function resolveHistoryLotIds(
  index: ProductionLotSearchIndex,
  input: {
    assemblyGroupId?: string
    orderLineId?: string
    recordDate: string
    orderNumber?: string
    productCode?: string
  },
) {
  const ids = new Set<string>()
  const date = String(input.recordDate || '').slice(0, 10)
  const groupId = String(input.assemblyGroupId || '').trim()
  const orderLineId = String(input.orderLineId || '').trim()
  const orderNumber = String(input.orderNumber || '').trim()
  const productCode = String(input.productCode || '').trim()
  const groupIds = [
    ...(groupId ? [groupId] : []),
    ...(orderLineId ? index.groupIdsByOrderLineId[orderLineId] || [] : []),
  ]

  // 기록일과 LOT 생산일이 일치할 때만 연결 (그룹 전체 LOT 추정 fallback 제거)
  for (const id of groupIds) {
    for (const lot of index.lotsByGroupDate[`${id}|${date}`] || []) ids.add(lot)
  }
  if (!ids.size && orderNumber && date) {
    for (const lot of index.lotsByOrderDate[`${orderNumber}|${date}`] || []) ids.add(lot)
  }
  if (!ids.size && productCode && date) {
    for (const lot of index.lotsByProductDate[`${productCode}|${date}`] || []) ids.add(lot)
  }
  return [...ids]
}

export type ShipmentSearchIndex = {
  shipmentByLotId: Record<string, string[]>
  shipmentByGroupId: Record<string, string[]>
}

export function emptyShipmentSearchIndex(): ShipmentSearchIndex {
  return {
    shipmentByLotId: {},
    shipmentByGroupId: {},
  }
}

export async function fetchShipmentSearchIndex(): Promise<ShipmentSearchIndex> {
  const empty = emptyShipmentSearchIndex()
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return empty
  }

  try {
    const supabase = createSupabaseClient()
    let [{ data: deliveries, error: deliveryError }, { data: lotLinks, error: lotLinkError }] =
      await Promise.all([
        supabase
          .from('delivery_records')
          .select('id, shipment_id, assembly_group_id')
          .limit(20000),
        supabase.from('delivery_record_lots').select('delivery_record_id, lot_id').limit(20000),
      ])

    if (deliveryError && /shipment_id/i.test(deliveryError.message)) {
      const fallback = await supabase.from('delivery_records').select('id, assembly_group_id').limit(20000)
      deliveries = (fallback.data || []).map((row) => ({
        id: row.id,
        assembly_group_id: row.assembly_group_id,
        shipment_id: null,
      }))
      deliveryError = fallback.error
    }

    if (deliveryError) {
      if (
        isMissingProductionLotsTable(deliveryError.message) ||
        deliveryError.message.includes('delivery_records')
      ) {
        return empty
      }
      return empty
    }

    const index = emptyShipmentSearchIndex()
    const shipmentByRecordId: Record<string, string[]> = {}

    for (const row of deliveries || []) {
      const recordId = String(row.id || '').trim()
      const shipmentId = String(row.shipment_id || '').trim()
      const groupId = String(row.assembly_group_id || '').trim()
      const numbers = [shipmentId, recordId].filter(Boolean)
      if (recordId) {
        for (const number of numbers) pushUniqueLot(shipmentByRecordId, recordId, number)
      }
      if (groupId) {
        for (const number of numbers) pushUniqueLot(index.shipmentByGroupId, groupId, number)
      }
    }

    if (!lotLinkError) {
      for (const row of lotLinks || []) {
        const recordId = String(row.delivery_record_id || '').trim()
        const lotId = String(row.lot_id || '').trim()
        if (!recordId || !lotId) continue
        for (const number of shipmentByRecordId[recordId] || [recordId]) {
          pushUniqueLot(index.shipmentByLotId, lotId, number)
        }
      }
    }

    return index
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error)
    if (isMissingProductionLotsTable(detail) || detail.includes('delivery_records')) return empty
    return empty
  }
}

export function resolveHistoryShipmentIds(
  index: ShipmentSearchIndex,
  lotIndex: ProductionLotSearchIndex,
  input: {
    lotIds: string[]
    assemblyGroupId?: string
    orderLineId?: string
  },
) {
  const ids = new Set<string>()
  for (const lotId of input.lotIds) {
    for (const shipment of index.shipmentByLotId[lotId] || []) ids.add(shipment)
  }
  if (!ids.size) {
    const groupIds = [
      ...(String(input.assemblyGroupId || '').trim() ? [String(input.assemblyGroupId).trim()] : []),
      ...(String(input.orderLineId || '').trim()
        ? lotIndex.groupIdsByOrderLineId[String(input.orderLineId).trim()] || []
        : []),
    ]
    for (const groupId of groupIds) {
      for (const shipment of index.shipmentByGroupId[groupId] || []) ids.add(shipment)
    }
  }
  return [...ids]
}

export { formatLotIdsLabel }

export async function fetchLotLabelsByDeliveryIds(deliveryIds: string[]): Promise<Record<string, string>> {
  const ids = [...new Set(deliveryIds.map((id) => String(id || '').trim()).filter(Boolean))]
  if (!ids.length) return {}
  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('delivery_record_lots')
      .select('delivery_record_id, lot_id, quantity')
      .in('delivery_record_id', ids)
    if (error || !data?.length) return {}

    const grouped = new Map<string, string[]>()
    for (const row of data) {
      const deliveryId = String(row.delivery_record_id)
      const lotId = String(row.lot_id || '').trim()
      if (!lotId) continue
      const list = grouped.get(deliveryId) || []
      if (!list.includes(lotId)) list.push(lotId)
      grouped.set(deliveryId, list)
    }

    const result: Record<string, string> = {}
    for (const [deliveryId, lotIds] of grouped) {
      result[deliveryId] = formatLotIdsLabel(lotIds)
    }
    return result
  } catch {
    return {}
  }
}
