import { assertCanWrite } from '@/lib/auth/assert-can-write'
import {
  allocateSoftReservations,
  buildAtpLinesFromAllocations,
  safetyStockForAtp,
  type MaterialAtpLine,
  type MaterialOrderAllocation,
} from '@/lib/materials/atp'
import {
  collectBomAlternatesForProduct,
  explodeBomToMaterials,
} from '@/lib/materials/outbound/utils'
import type { BomEdge } from '@/lib/materials/outbound/types'
import type { Material } from '@/lib/materials/types'
import type { OrderListGroup } from '@/lib/orders/types'
import { createSupabaseClient } from '@/lib/supabase'
import { isMissingRpcFunction } from '@/lib/supabase/rpc'

export type FetchAllocationsResult =
  | { ok: true; allocations: MaterialOrderAllocation[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SyncAllocationsResult =
  | { ok: true; allocations: MaterialOrderAllocation[]; atpLines: MaterialAtpLine[] }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

function missingEnv(): Extract<FetchAllocationsResult, { ok: false }> {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export function isMissingMaterialOrderAllocationsTable(detail: string) {
  return (
    detail.includes('material_order_allocations') ||
    (detail.includes('schema cache') && detail.includes('allocation'))
  )
}

/** 주문 연동 PO 미입고 잔량 — key: orderId::materialId */
export async function fetchPendingInboundByOrderMaterial(): Promise<
  | { ok: true; pendingByOrderMaterial: Map<string, number> }
  | { ok: false; reason: 'env' | 'query'; detail: string }
> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('material_purchase_orders')
      .select(
        `
        source_order_id,
        material_purchase_order_lines (
          material_id,
          quantity,
          inbound_quantity
        )
      `,
      )
      .not('source_order_id', 'is', null)

    if (error) {
      if (error.message.includes('source_order_id')) {
        return { ok: true, pendingByOrderMaterial: new Map() }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const pendingByOrderMaterial = new Map<string, number>()
    for (const po of data || []) {
      const orderId = String(po.source_order_id || '').trim()
      if (!orderId) continue
      for (const line of po.material_purchase_order_lines || []) {
        const materialId = String(line.material_id || '').trim()
        if (!materialId) continue
        const pending = Math.max(
          0,
          Math.floor(Number(line.quantity) || 0) - Math.floor(Number(line.inbound_quantity) || 0),
        )
        if (pending <= 0) continue
        const key = `${orderId}::${materialId}`
        pendingByOrderMaterial.set(key, (pendingByOrderMaterial.get(key) ?? 0) + pending)
      }
    }

    return { ok: true, pendingByOrderMaterial }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

function mapAllocationRow(row: {
  order_id?: string | null
  material_id?: string | null
  required_qty?: number | string | null
  reserved_qty?: number | string | null
  issued_qty?: number | string | null
}): MaterialOrderAllocation | null {
  const orderId = String(row.order_id || '').trim()
  const materialId = String(row.material_id || '').trim()
  if (!orderId || !materialId) return null
  return {
    orderId,
    materialId,
    requiredQty: Math.max(0, Math.floor(Number(row.required_qty) || 0)),
    reservedQty: Math.max(0, Math.floor(Number(row.reserved_qty) || 0)),
    issuedQty: Math.max(0, Math.floor(Number(row.issued_qty) || 0)),
  }
}

export async function fetchMaterialOrderAllocations(): Promise<FetchAllocationsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnv()
  }

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('material_order_allocations')
      .select('order_id, material_id, required_qty, reserved_qty, issued_qty')

    if (error) {
      if (isMissingMaterialOrderAllocationsTable(error.message)) {
        return { ok: true, allocations: [] }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    const allocations = (data || [])
      .map((row) => mapAllocationRow(row))
      .filter((row): row is MaterialOrderAllocation => Boolean(row))

    return { ok: true, allocations }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

function buildEdgesByParent(bomEdges: BomEdge[]) {
  const map = new Map<string, BomEdge[]>()
  for (const edge of bomEdges) {
    if (!edge.parentProductId || !edge.childProductId) continue
    const list = map.get(edge.parentProductId) || []
    list.push(edge)
    map.set(edge.parentProductId, list)
  }
  return map
}

/** 주문 BOM 총소요 (제품×자재 합 → 주문×자재) */
export function buildRequiredByOrderMaterial(
  orders: OrderListGroup[],
  bomEdges: BomEdge[],
): Map<string, Map<string, number>> {
  const edgesByParent = buildEdgesByParent(bomEdges)
  const requiredByOrderMaterial = new Map<string, Map<string, number>>()

  for (const order of orders) {
    const byMaterial = new Map<string, number>()
    for (const item of order.items) {
      if (item.derivedFromLineId) continue
      const productId = (item.productId || item.productCode || '').trim()
      const orderQty = Math.max(0, Math.floor(Number(item.quantity) || 0))
      if (!productId || orderQty <= 0) continue
      const exploded = explodeBomToMaterials(productId, orderQty, edgesByParent)
      for (const [materialId, required] of exploded) {
        byMaterial.set(materialId, (byMaterial.get(materialId) ?? 0) + required)
      }
    }
    if (byMaterial.size) requiredByOrderMaterial.set(order.orderId, byMaterial)
  }

  return requiredByOrderMaterial
}

/** 주문별 BOM 대체 (orderId → 주자재 → 대체 품목 ID) */
export function buildAlternatesByOrderMaterial(
  orders: OrderListGroup[],
  bomEdges: BomEdge[],
): Map<string, Map<string, string[]>> {
  const edgesByParent = buildEdgesByParent(bomEdges)
  const result = new Map<string, Map<string, string[]>>()
  for (const order of orders) {
    const byPrimary = new Map<string, string[]>()
    for (const item of order.items) {
      if (item.derivedFromLineId) continue
      const productId = (item.productId || item.productCode || '').trim()
      if (!productId) continue
      collectBomAlternatesForProduct(productId, edgesByParent, byPrimary)
    }
    if (byPrimary.size) result.set(order.orderId, byPrimary)
  }
  return result
}

/**
 * 열린 주문에 대해 소프트 예약을 재계산·저장.
 * issued_qty 는 DB에 있는 값을 유지(또는 issuedByOrderMaterial 로 덮어씀).
 */
export async function syncMaterialOrderAllocations(input: {
  orders: OrderListGroup[]
  bomEdges: BomEdge[]
  materials: Material[]
  onHandByMaterialId: Map<string, number>
  /** key: orderId::materialId */
  pendingInboundByOrderMaterial?: Map<string, number>
  /** 불출 실적 — 없으면 기존 DB issued 유지 */
  issuedByOrderMaterial?: Map<string, Map<string, number>>
  persist?: boolean
}): Promise<SyncAllocationsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const existing = await fetchMaterialOrderAllocations()
  if (!existing.ok) return existing

  const issuedFromDb = new Map<string, Map<string, number>>()
  for (const row of existing.allocations) {
    let byMaterial = issuedFromDb.get(row.orderId)
    if (!byMaterial) {
      byMaterial = new Map()
      issuedFromDb.set(row.orderId, byMaterial)
    }
    byMaterial.set(row.materialId, row.issuedQty)
  }

  const issuedMap = input.issuedByOrderMaterial || issuedFromDb
  const requiredByOrderMaterial = buildRequiredByOrderMaterial(input.orders, input.bomEdges)

  const safetyStockByMaterialId = new Map<string, number>()
  for (const material of input.materials) {
    safetyStockByMaterialId.set(material.id, safetyStockForAtp(material))
  }

  const orderPriority = input.orders.map((order) => ({
    orderId: order.orderId,
    deliveryDate: order.deliveryDate || '',
    orderNumber: order.orderNumber || '',
  }))

  const allocations = allocateSoftReservations({
    requiredByOrderMaterial,
    issuedByOrderMaterial: issuedMap,
    onHandByMaterialId: input.onHandByMaterialId,
    safetyStockByMaterialId,
    pendingInboundByOrderMaterial: input.pendingInboundByOrderMaterial,
    orderPriority,
    alternatesByOrderMaterial: buildAlternatesByOrderMaterial(input.orders, input.bomEdges),
  })

  const atpLines = buildAtpLinesFromAllocations({
    allocations,
    pendingInboundByOrderMaterial: input.pendingInboundByOrderMaterial,
  })

  if (input.persist === false) {
    return { ok: true, allocations, atpLines }
  }

  const gate = await assertCanWrite({ module: 'materials', action: 'update' })
  if (!gate.ok) {
    // 읽기 전용 화면에서도 ATP는 계산 가능하게 — persist 실패 시 계산만 반환
    return { ok: true, allocations, atpLines }
  }

  try {
    const supabase = createSupabaseClient()
    const openOrderIds = new Set(input.orders.map((order) => order.orderId))
    const nextKeys = new Set(allocations.map((row) => `${row.orderId}::${row.materialId}`))

    const toDelete = existing.allocations.filter(
      (row) => openOrderIds.has(row.orderId) && !nextKeys.has(`${row.orderId}::${row.materialId}`),
    )

    const deleteMaterialIdsByOrder = new Map<string, string[]>()
    for (const row of toDelete) {
      const ids = deleteMaterialIdsByOrder.get(row.orderId)
      if (ids) ids.push(row.materialId)
      else deleteMaterialIdsByOrder.set(row.orderId, [row.materialId])
    }
    for (const [orderId, materialIds] of deleteMaterialIdsByOrder) {
      const { error } = await supabase
        .from('material_order_allocations')
        .delete()
        .eq('order_id', orderId)
        .in('material_id', materialIds)
      if (error && !isMissingMaterialOrderAllocationsTable(error.message)) {
        return { ok: false, reason: 'query', detail: error.message }
      }
    }

    if (allocations.length) {
      const upsertRows = allocations.map((row) => ({
        order_id: row.orderId,
        material_id: row.materialId,
        required_qty: row.requiredQty,
        reserved_qty: row.reservedQty,
        issued_qty: row.issuedQty,
        updated_at: new Date().toISOString(),
      }))

      const { error } = await supabase.from('material_order_allocations').upsert(upsertRows, {
        onConflict: 'order_id,material_id',
      })

      if (error) {
        if (isMissingMaterialOrderAllocationsTable(error.message)) {
          return { ok: true, allocations, atpLines }
        }
        return { ok: false, reason: 'query', detail: error.message }
      }
    }

    return { ok: true, allocations, atpLines }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/** 생산 불출 전 — 주문 ATP 가용 검증 */
export async function assertOutboundWithinOrderAtp(input: {
  orderId: string
  items: Array<{ material_id: string; quantity: number }>
  atpLines: MaterialAtpLine[]
}): Promise<string | null> {
  const orderId = input.orderId.trim()
  if (!orderId) return '생산 불출은 주문을 선택해 주세요.'

  const needByMaterial = new Map<string, number>()
  for (const item of input.items) {
    const materialId = item.material_id.trim()
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
    if (!materialId || quantity <= 0) continue
    needByMaterial.set(materialId, (needByMaterial.get(materialId) ?? 0) + quantity)
  }

  for (const [materialId, quantity] of needByMaterial) {
    const line = input.atpLines.find(
      (row) => row.orderId === orderId && row.materialId === materialId,
    )
    const available = line?.availableQty ?? 0
    if (quantity > available) {
      return (
        `주문 예약 수량을 초과합니다. (${materialId}: 요청 ${quantity.toLocaleString('ko-KR')} / ` +
        `이 주문 가용 ${available.toLocaleString('ko-KR')})`
      )
    }
  }

  return null
}

/** 'applied' = DB 에서 원자적으로 반영됨, 'missing' = RPC 미적용 DB (기존 방식으로 처리) */
async function applyAllocationIssueAtomic(
  orderId: string,
  materialId: string,
  issuedDelta: number,
): Promise<'applied' | 'missing' | { ok: true } | { ok: false; reason: 'query'; detail: string }> {
  const { error } = await createSupabaseClient().rpc('apply_material_allocation_issue', {
    p_order_id: orderId,
    p_material_id: materialId,
    p_issued_delta: issuedDelta,
  })
  if (!error) return 'applied'
  if (isMissingRpcFunction(error.message)) return 'missing'
  if (isMissingMaterialOrderAllocationsTable(error.message)) return { ok: true }
  return { ok: false, reason: 'query', detail: error.message }
}

/** 불출 후 issued_qty 증가 + reserved 재조정은 sync 로 맡김 */
export async function applyOutboundIssuedToAllocations(input: {
  orderId: string
  items: Array<{ material_id: string; quantity: number }>
}): Promise<{ ok: true } | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const gate = await assertCanWrite({ module: 'materials', action: 'update' })
  if (!gate.ok) return gate

  const orderId = input.orderId.trim()
  if (!orderId) return { ok: true }

  try {
    const supabase = createSupabaseClient()
    const byMaterial = new Map<string, number>()
    for (const item of input.items) {
      const materialId = item.material_id.trim()
      const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
      if (!materialId || quantity <= 0) continue
      byMaterial.set(materialId, (byMaterial.get(materialId) ?? 0) + quantity)
    }

    for (const [materialId, quantity] of byMaterial) {
      const atomic = await applyAllocationIssueAtomic(orderId, materialId, quantity)
      if (atomic === 'applied') continue
      if (atomic !== 'missing') return atomic

      const { data, error } = await supabase
        .from('material_order_allocations')
        .select('required_qty, reserved_qty, issued_qty')
        .eq('order_id', orderId)
        .eq('material_id', materialId)
        .maybeSingle()

      if (error) {
        if (isMissingMaterialOrderAllocationsTable(error.message)) return { ok: true }
        return { ok: false, reason: 'query', detail: error.message }
      }

      const requiredQty = Math.max(0, Math.floor(Number(data?.required_qty) || 0))
      const prevIssued = Math.max(0, Math.floor(Number(data?.issued_qty) || 0))
      const prevReserved = Math.max(0, Math.floor(Number(data?.reserved_qty) || 0))
      const issuedQty = prevIssued + quantity
      const reservedQty = Math.max(0, prevReserved - quantity)

      const { error: upsertError } = await supabase.from('material_order_allocations').upsert(
        {
          order_id: orderId,
          material_id: materialId,
          required_qty: Math.max(requiredQty, issuedQty),
          reserved_qty: reservedQty,
          issued_qty: issuedQty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id,material_id' },
      )

      if (upsertError) {
        if (isMissingMaterialOrderAllocationsTable(upsertError.message)) return { ok: true }
        return { ok: false, reason: 'query', detail: upsertError.message }
      }
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

/** 잔량반납 시 issued 감소 */
export async function applyRestockToAllocations(input: {
  orderId: string
  items: Array<{ material_id: string; quantity: number }>
}): Promise<{ ok: true } | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const gate = await assertCanWrite({ module: 'materials', action: 'update' })
  if (!gate.ok) return gate

  const orderId = input.orderId.trim()
  if (!orderId) return { ok: true }

  try {
    const supabase = createSupabaseClient()
    for (const item of input.items) {
      const materialId = item.material_id.trim()
      const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
      if (!materialId || quantity <= 0) continue

      const atomic = await applyAllocationIssueAtomic(orderId, materialId, -quantity)
      if (atomic === 'applied') continue
      if (atomic !== 'missing') return atomic

      const { data, error } = await supabase
        .from('material_order_allocations')
        .select('required_qty, reserved_qty, issued_qty')
        .eq('order_id', orderId)
        .eq('material_id', materialId)
        .maybeSingle()

      if (error) {
        if (isMissingMaterialOrderAllocationsTable(error.message)) return { ok: true }
        return { ok: false, reason: 'query', detail: error.message }
      }
      if (!data) continue

      const issuedQty = Math.max(0, Math.floor(Number(data.issued_qty) || 0) - quantity)
      const reservedQty = Math.max(0, Math.floor(Number(data.reserved_qty) || 0)) + quantity

      const { error: upsertError } = await supabase.from('material_order_allocations').upsert(
        {
          order_id: orderId,
          material_id: materialId,
          required_qty: Math.max(0, Math.floor(Number(data.required_qty) || 0)),
          reserved_qty: reservedQty,
          issued_qty: issuedQty,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'order_id,material_id' },
      )

      if (upsertError && !isMissingMaterialOrderAllocationsTable(upsertError.message)) {
        return { ok: false, reason: 'query', detail: upsertError.message }
      }
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

/** 입고·주문변경 후 소프트 예약 재계산 */
export async function resyncMaterialOrderAllocationsAfterStockChange(input: {
  orders: OrderListGroup[]
  bomEdges: BomEdge[]
  materials: Material[]
  onHandByMaterialId: Map<string, number>
  issuedByOrderMaterial?: Map<string, Map<string, number>>
}): Promise<SyncAllocationsResult> {
  const pending = await fetchPendingInboundByOrderMaterial()
  return syncMaterialOrderAllocations({
    orders: input.orders,
    bomEdges: input.bomEdges,
    materials: input.materials,
    onHandByMaterialId: input.onHandByMaterialId,
    pendingInboundByOrderMaterial: pending.ok ? pending.pendingByOrderMaterial : new Map(),
    issuedByOrderMaterial: input.issuedByOrderMaterial,
    persist: true,
  })
}
