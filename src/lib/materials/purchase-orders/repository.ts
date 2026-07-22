import { createSupabaseClient } from '@/lib/supabase'
import { fetchBomEdges } from '@/lib/materials/outbound/repository'
import type { BomEdge } from '@/lib/materials/outbound/types'
import { fetchMaterials } from '@/lib/materials/repository'
import type { Material } from '@/lib/materials/types'
import { fetchOrders } from '@/lib/orders/repository'
import { fetchOnHandByMaterialId } from '@/lib/materials/inventory/stock'
import {
  buildOrderPurchaseCards,
  buildOrderPurchaseMaterialPreview,
  buildPurchaseSuggestionLines,
} from './need-utils'
import type {
  MaterialPurchaseOrderListGroup,
  MaterialPurchaseOrderRecord,
  MaterialPurchaseOrderRowPayload,
  MaterialPurchaseSuggestionLine,
  OrderPurchaseCard,
  OrderPurchaseMaterialPreview,
} from './types'
import { groupMaterialPurchaseOrdersFromRecords } from './utils'

export type FetchMaterialPurchaseOrdersResult =
  | { ok: true; orders: MaterialPurchaseOrderListGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchMaterialPurchaseRegisterResult =
  | {
      ok: true
      /** 자재 기준 발주 제안 (발주필요 > 0 자재만) */
      suggestionLines: MaterialPurchaseSuggestionLine[]
    }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type FetchMaterialPurchaseByOrderResult =
  | {
      ok: true
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
  | { ok: false; reason: 'env' | 'query' | 'validation'; detail: string }

export type DeleteMaterialPurchaseOrderResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query'; detail: string }

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
  }))

  const { error } = await supabase.from('material_purchase_order_lines').insert(rows)
  if (error) throw new Error(error.message)
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
    // 발주 화면에서 제외 처리한 주문서는 소요 집계에서 제외
    const activeOrders = ordersResult.orders.filter(
      (order) => !deletedNeedOrderIds.has(order.orderId),
    )

    const suggestionLines = buildPurchaseSuggestionLines({
      orders: activeOrders,
      bomEdges,
      materials: materialsResult.materials,
      onHandByMaterialId: onHandResult.onHandByMaterialId,
      purchaseOrders: purchaseOrdersResult.orders,
    })

    return {
      ok: true,
      suggestionLines,
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

/** 주문서 단위 부분 발주 화면 데이터 */
export async function fetchMaterialPurchaseOrderByOrderData(): Promise<FetchMaterialPurchaseByOrderResult> {
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
    const activeOrders = ordersResult.orders.filter(
      (order) => !deletedNeedOrderIds.has(order.orderId),
    )

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
      cards,
      materials: materialsResult.materials,
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

export function previewOrderPurchaseMaterials(input: {
  productId: string
  purchaseQuantity: number
  bomEdges: BomEdge[]
  materials: Material[]
  onHandByMaterialId: Record<string, number>
}): OrderPurchaseMaterialPreview[] {
  return buildOrderPurchaseMaterialPreview({
    productId: input.productId,
    purchaseQuantity: input.purchaseQuantity,
    bomEdges: input.bomEdges,
    materials: input.materials,
    onHandByMaterialId: new Map(
      Object.entries(input.onHandByMaterialId).map(([id, qty]) => [id, qty]),
    ),
  })
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

  try {
    const supabase = createSupabaseClient()
    const insertRow: Record<string, unknown> = {
      order_date: payload.order_date,
      delivery_date: payload.delivery_date || null,
      supplier: payload.supplier,
    }
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
          '부분 발주 정보가 불완전합니다. 발주 화면에서 제품 수량을 다시 입력한 뒤 저장해 주세요.',
      }
    }

    let { data: inserted, error } = await supabase
      .from('material_purchase_orders')
      .insert(insertRow)
      .select('id')
      .single()

    // 커버 컬럼이 없으면 발주만 성공시키고 넘어가면 카드의 "발주" 수량이 영원히 0이 된다.
    // 주문서 발주(커버 수량 포함)인 경우 마이그레이션 안내로 실패 처리한다.
    if (
      error &&
      (error.message.includes('covered_order_line_id') ||
        error.message.includes('covered_product_quantity'))
    ) {
      return {
        ok: false,
        reason: 'query',
        detail:
          '부분 발주 기록 컬럼이 없습니다. Supabase에서 supabase/migrate-material-purchase-orders-partial-cover.sql 을 실행한 뒤 다시 저장해 주세요.',
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

    if (error || !inserted?.id) {
      return { ok: false, reason: 'query', detail: error?.message || '자재 발주 저장에 실패했습니다.' }
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

  try {
    const supabase = createSupabaseClient()
    const { data: existing, error: fetchError } = await supabase
      .from('material_purchase_orders')
      .select('id')
      .eq('id', orderId)
      .maybeSingle()

    if (fetchError) return { ok: false, reason: 'query', detail: fetchError.message }
    if (!existing?.id) {
      return { ok: false, reason: 'query', detail: `발주를 찾을 수 없습니다: ${orderId}` }
    }

    if (await fetchOrderHasInbound(existing.id)) {
      return {
        ok: false,
        reason: 'query',
        detail: '입고 이력이 있는 발주는 수정할 수 없습니다.',
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

  try {
    if (await fetchOrderHasInbound(orderId)) {
      return {
        ok: false,
        reason: 'query',
        detail: '입고 이력이 있는 발주는 삭제할 수 없습니다.',
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

