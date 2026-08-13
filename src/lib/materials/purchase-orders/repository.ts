import { fetchAssemblyGroups } from '@/lib/assembly/repository'
import { assertCanWrite } from '@/lib/auth/assert-can-write'
import {
  isMissingCreatedByColumn,
  stripCreatedByFields,
  withCreatedByFields,
} from '@/lib/auth/created-by'
import { fetchDeliveryCumulativeCounts } from '@/lib/delivery/repository'
import { buildFullyShippedOrderIdSet } from '@/lib/delivery/utils'
import { createSupabaseClient } from '@/lib/supabase'
import { fetchBomEdges } from '@/lib/materials/outbound/repository'
import type { BomEdge } from '@/lib/materials/outbound/types'
import { fetchMaterials } from '@/lib/materials/repository'
import type { Material } from '@/lib/materials/types'
import { mapItemRowToMaterial } from '@/lib/materials/utils'
import { fetchOrders } from '@/lib/orders/repository'
import { fetchOnHandByMaterialId } from '@/lib/materials/inventory/stock'
import type { OrderListGroup } from '@/lib/orders/types'
import {
  buildOrderPurchaseCards,
  buildPurchaseSuggestionLines,
} from './need-utils'
import type {
  MaterialPurchaseOrderListGroup,
  MaterialPurchaseOrderRecord,
  MaterialPurchaseOrderRowPayload,
  MaterialPurchaseSuggestionLine,
  OrderPurchaseCard,
} from './types'
import { groupMaterialPurchaseOrdersFromRecords } from './utils'

/** BOM 구성품이 fetchMaterials(원자재·부자재)에 빠져 있으면 items에서 보강 */
async function mergeMaterialsFromBomLeaves(
  materials: Material[],
  bomEdges: BomEdge[],
): Promise<Material[]> {
  const known = new Set(materials.map((material) => material.id.trim().toLowerCase()).filter(Boolean))
  const missingIds = [
    ...new Set(
      bomEdges
        .filter((edge) => edge.childItemCategory === 1 || edge.childItemCategory === 2)
        .map((edge) => edge.childProductId.trim())
        .filter((id) => id && !known.has(id.toLowerCase())),
    ),
  ]
  if (!missingIds.length) return materials

  const supabase = createSupabaseClient()
  const { data, error } = await supabase.from('items').select('*').in('id', missingIds)
  if (error || !data?.length) return materials

  const extras = data.map((row) => mapItemRowToMaterial(row as Parameters<typeof mapItemRowToMaterial>[0]))
  return [...materials, ...extras]
}

/** 수동 제외 + 출하완료 주문을 구매발주 소요/카드에서 빼기 (불출과 동일 규칙) */
async function filterOrdersForPurchaseNeed(
  orders: OrderListGroup[],
  deletedNeedOrderIds: Set<string>,
): Promise<OrderListGroup[]> {
  const [assemblyResult, deliveryCountsResult] = await Promise.all([
    fetchAssemblyGroups(),
    fetchDeliveryCumulativeCounts(),
  ])

  const fullyShippedOrderIds =
    assemblyResult.ok && deliveryCountsResult.ok
      ? buildFullyShippedOrderIdSet(assemblyResult.groups, deliveryCountsResult.counts)
      : new Set<string>()

  return orders.filter(
    (order) =>
      !deletedNeedOrderIds.has(order.orderId) && !fullyShippedOrderIds.has(order.orderId),
  )
}

export type FetchMaterialPurchaseOrdersResult =
  | { ok: true; orders: MaterialPurchaseOrderListGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchMaterialPurchaseRegisterResult =
  | {
      ok: true
      /** 자재 기준 구매발주 제안 (구매발주필요 > 0 자재만) */
      suggestionLines: MaterialPurchaseSuggestionLine[]
      /** 부분 구매발주(발주서·대수)용 카드 */
      cards: OrderPurchaseCard[]
      materials: Material[]
      bomEdges: BomEdge[]
      onHandByMaterialId: Record<string, number>
    }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchMaterialPurchaseHistoryResult =
  | { ok: true; orders: MaterialPurchaseOrderListGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveMaterialPurchaseOrderResult =
  | { ok: true; orderId: string; orderNumber: string }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type DeleteMaterialPurchaseOrderResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

function missingEnvResult(): SaveMaterialPurchaseOrderResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

export function isMissingMaterialPurchaseOrdersTable(detail: string) {
  return (
    detail.includes('material_purchase_orders') ||
    detail.includes('material_purchase_order_lines') ||
    detail.includes('material_purchase_need_deleted_orders') ||
    detail.includes('schema cache')
  )
}

function isMissingNeedDeletedOrdersTable(detail: string) {
  return (
    detail.includes('material_purchase_need_deleted_orders') ||
    detail.includes('schema cache')
  )
}

async function fetchDeletedNeedOrderIds(): Promise<
  { ok: true; orderIds: string[] } | { ok: false; detail: string }
> {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('material_purchase_need_deleted_orders')
    .select('order_id')

  if (error) {
    // 마이그레이션 전이면 빈 목록으로 동작
    if (isMissingNeedDeletedOrdersTable(error.message)) {
      return { ok: true, orderIds: [] }
    }
    return { ok: false, detail: error.message }
  }

  return {
    ok: true,
    orderIds: (data || [])
      .map((row) => String(row.order_id || '').trim())
      .filter(Boolean),
  }
}

function isMissingLineDeliveryDateColumn(detail: string) {
  const lower = detail.toLowerCase()
  return (
    lower.includes('delivery_date') &&
    (lower.includes('column') || lower.includes('schema cache') || lower.includes('could not find'))
  )
}

async function insertMaterialPurchaseOrderLines(
  orderId: string,
  items: MaterialPurchaseOrderRowPayload['items'],
) {
  const supabase = createSupabaseClient()
  const rows = items.map((item, index) => ({
    order_id: orderId,
    line_seq: index,
    material_id: item.materialId || null,
    cpn: item.materialCode,
    material_name: item.materialName,
    specification: item.specification,
    mpn: item.mpn,
    quantity: item.quantity,
    unit_price: item.unitPrice,
    order_amount: item.orderAmount,
    status: item.status,
    inbound_quantity: item.inboundQuantity,
    delivery_date: item.deliveryDate || null,
  }))

  const { error } = await supabase.from('material_purchase_order_lines').insert(rows)
  if (error) {
    if (!isMissingLineDeliveryDateColumn(error.message)) {
      throw new Error(error.message)
    }
    // 마이그레이션 전 DB: 라인 납기 컬럼 없이 저장 (헤더 납기로 대체)
    const legacyRows = rows.map(({ delivery_date: _deliveryDate, ...row }) => row)
    const retry = await supabase.from('material_purchase_order_lines').insert(legacyRows)
    if (retry.error) throw new Error(retry.error.message)
  }
}

async function fetchOrderHasInbound(orderId: string) {
  const supabase = createSupabaseClient()
  const { data, error } = await supabase
    .from('material_purchase_order_lines')
    .select('inbound_quantity')
    .eq('order_id', orderId)

  if (error) throw new Error(error.message)
  return (data || []).some((line) => Number(line.inbound_quantity) > 0)
}

export async function fetchMaterialPurchaseOrders(): Promise<FetchMaterialPurchaseOrdersResult> {
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
      .select('*, material_purchase_order_lines(*)')
      .order('order_date', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const orders = groupMaterialPurchaseOrdersFromRecords((data || []) as MaterialPurchaseOrderRecord[])
    return { ok: true, orders }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchMaterialPurchaseOrderRegisterData(): Promise<FetchMaterialPurchaseRegisterResult> {
  const [materialsResult, ordersResult, purchaseOrdersResult] = await Promise.all([
    fetchMaterials(),
    fetchOrders({ includeDerivedLines: true }),
    fetchMaterialPurchaseOrders(),
  ])

  if (!materialsResult.ok) return materialsResult
  if (!ordersResult.ok) return ordersResult
  if (!purchaseOrdersResult.ok) return purchaseOrdersResult

  try {
    const [bomEdges, onHandResult, deletedNeedIdsResult] = await Promise.all([
      fetchBomEdges(),
      fetchOnHandByMaterialId(),
      fetchDeletedNeedOrderIds(),
    ])

    if (!deletedNeedIdsResult.ok) {
      return { ok: false, reason: 'query', detail: deletedNeedIdsResult.detail }
    }
    if (!onHandResult.ok) {
      return { ok: false, reason: 'query', detail: onHandResult.detail }
    }

    const deletedNeedOrderIds = new Set(deletedNeedIdsResult.orderIds)
    const activeOrders = await filterOrdersForPurchaseNeed(
      ordersResult.orders,
      deletedNeedOrderIds,
    )

    const materials = await mergeMaterialsFromBomLeaves(materialsResult.materials, bomEdges)

    const suggestionLines = buildPurchaseSuggestionLines({
      orders: activeOrders,
      bomEdges,
      materials,
      onHandByMaterialId: onHandResult.onHandByMaterialId,
      purchaseOrders: purchaseOrdersResult.orders,
    })

    const cards = buildOrderPurchaseCards({
      orders: activeOrders,
      bomEdges,
      purchaseOrders: purchaseOrdersResult.orders,
    })

    const onHandByMaterialId: Record<string, number> = {}
    for (const [materialId, qty] of onHandResult.onHandByMaterialId.entries()) {
      onHandByMaterialId[materialId] = qty
    }

    return {
      ok: true,
      suggestionLines,
      cards,
      materials,
      bomEdges,
      onHandByMaterialId,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function fetchMaterialPurchaseOrderHistoryData(): Promise<FetchMaterialPurchaseHistoryResult> {
  return fetchMaterialPurchaseOrders()
}

export async function createMaterialPurchaseOrder(
  payload: MaterialPurchaseOrderRowPayload,
): Promise<SaveMaterialPurchaseOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'materials', action: 'create' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    let insertRow: Record<string, unknown> = await withCreatedByFields({
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      supplier: payload.supplier,
    })
    if (payload.source_order_id) {
      insertRow.source_order_id = payload.source_order_id
    }
    if (payload.covered_order_line_id) {
      insertRow.covered_order_line_id = payload.covered_order_line_id
    }
    if (
      payload.covered_product_quantity != null &&
      Number(payload.covered_product_quantity) > 0
    ) {
      insertRow.covered_product_quantity = Math.floor(Number(payload.covered_product_quantity))
    }

    // 라인만/수량만 한쪽만 오면 커버 집계가 깨지므로 둘 다 있을 때만 허용
    const hasCoverLine = Boolean(insertRow.covered_order_line_id)
    const hasCoverQty =
      insertRow.covered_product_quantity != null &&
      Number(insertRow.covered_product_quantity) > 0
    if (hasCoverLine !== hasCoverQty) {
      return {
        ok: false,
        reason: 'validation',
        detail:
          '부분 구매발주 정보가 불완전합니다. 구매발주 화면에서 제품 수량을 다시 입력한 뒤 저장해 주세요.',
      }
    }

    let { data: inserted, error } = await supabase
      .from('material_purchase_orders')
      .insert(insertRow)
      .select('id')
      .single()

    // 커버 컬럼이 없으면 구매발주만 성공시키고 넘어가면 카드의 "구매발주" 수량이 영원히 0이 된다.
    // 발주서 구매발주(커버 수량 포함)인 경우 마이그레이션 안내로 실패 처리한다.
    if (
      error &&
      (error.message.includes('covered_order_line_id') ||
        error.message.includes('covered_product_quantity'))
    ) {
      return {
        ok: false,
        reason: 'query',
        detail:
          '부분 구매발주 기록 컬럼이 없습니다. Supabase에서 supabase/migrate-material-purchase-orders-partial-cover.sql 을 실행한 뒤 다시 저장해 주세요.',
      }
    }

    // source_order_id 만 없는 구환경이면 연결 없이 재시도
    if (error && error.message.includes('source_order_id')) {
      delete insertRow.source_order_id
      ;({ data: inserted, error } = await supabase
        .from('material_purchase_orders')
        .insert(insertRow)
        .select('id')
        .single())
    }

    if (error && isMissingCreatedByColumn(error.message)) {
      insertRow = stripCreatedByFields(insertRow)
      ;({ data: inserted, error } = await supabase
        .from('material_purchase_orders')
        .insert(insertRow)
        .select('id')
        .single())
    }

    if (error || !inserted?.id) {
      return { ok: false, reason: 'query', detail: error?.message || '구매발주 저장에 실패했습니다.' }
    }

    await insertMaterialPurchaseOrderLines(inserted.id, payload.items)
    return { ok: true, orderId: inserted.id, orderNumber: inserted.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateMaterialPurchaseOrder(
  orderId: string,
  payload: MaterialPurchaseOrderRowPayload,
): Promise<SaveMaterialPurchaseOrderResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'materials', action: 'update' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from('material_purchase_orders')
      .select('id')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchError) return { ok: false, reason: 'query', detail: fetchError.message }
    if (!existing?.id) {
      return { ok: false, reason: 'query', detail: `구매발주를 찾을 수 없습니다: ${orderId}` }
    }

    if (await fetchOrderHasInbound(existing.id)) {
      return {
        ok: false,
        reason: 'query',
        detail: '입고 이력이 있는 구매발주는 수정할 수 없습니다.',
      }
    }

    const { error: updateError } = await supabase
      .from('material_purchase_orders')
      .update({
        order_date: payload.order_date,
        delivery_date: payload.delivery_date || null,
        supplier: payload.supplier,
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id)

    if (updateError) return { ok: false, reason: 'query', detail: updateError.message }

    const { error: deleteError } = await supabase
      .from('material_purchase_order_lines')
      .delete()
      .eq('order_id', existing.id)

    if (deleteError) return { ok: false, reason: 'query', detail: deleteError.message }

    await insertMaterialPurchaseOrderLines(existing.id, payload.items)
    return { ok: true, orderId: existing.id, orderNumber: existing.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteMaterialPurchaseOrder(
  orderId: string,
): Promise<DeleteMaterialPurchaseOrderResult> {
  if (!orderId.trim()) return { ok: true }

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  const gate = await assertCanWrite({ module: 'materials', action: 'delete' })
  if (!gate.ok) return gate

  try {
    if (await fetchOrderHasInbound(orderId)) {
      return {
        ok: false,
        reason: 'query',
        detail: '입고 이력이 있는 구매발주는 삭제할 수 없습니다.',
      }
    }

    const supabase = createSupabaseClient()
    const { error } = await supabase.from('material_purchase_orders').delete().eq('id', orderId)

    if (error) {
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

