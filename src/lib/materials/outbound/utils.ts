import { formatMaterialPurchaseOrderDate } from '@/lib/materials/purchase-orders/utils'
import type { OrderListGroup } from '@/lib/orders/types'
import type {
  BomEdge,
  MaterialOutboundListGroup,
  MaterialOutboundNeedCard,
  MaterialOutboundNeedRow,
  MaterialOutboundOrderCard,
  MaterialOutboundRecord,
  MaterialOutboundType,
  OutboundMaterialBucket,
} from './types'
import { MATERIAL_OUTBOUND_TYPE_LABELS } from './types'

/** 자재 마스터 구분(items.material_type) → 불출 구분 */
export function resolveMaterialBucket(materialType: string | null | undefined): OutboundMaterialBucket {
  const value = String(materialType ?? '').trim().toUpperCase()
  if (value === 'SMD') return 'SMD'
  if (value === 'DIP') return 'DIP'
  return 'ETC'
}

/** 불출 구분 필터: bucket 지정 시 해당 구분 자재만 남긴다 */
export type OutboundBucketFilter = {
  bucket: OutboundMaterialBucket
  bucketByMaterialId: Map<string, OutboundMaterialBucket>
}

function matchesBucket(materialId: string, filter: OutboundBucketFilter | undefined): boolean {
  if (!filter) return true
  return (filter.bucketByMaterialId.get(materialId) ?? 'ETC') === filter.bucket
}

export function normalizeOutboundType(value: string | null | undefined): MaterialOutboundType {
  if (value === 'production' || value === 'scrap' || value === 'adjustment') return value
  return 'production'
}

export function getOutboundTypeLabel(type: MaterialOutboundType) {
  return MATERIAL_OUTBOUND_TYPE_LABELS[type]
}

export function mapOutboundRecord(
  record: MaterialOutboundRecord,
  orderMeta?: { orderNumber: string; customer: string } | null,
): MaterialOutboundListGroup {
  const lines = [...(record.material_outbound_lines || [])].sort((a, b) => a.line_seq - b.line_seq)
  const items = lines.map((line) => ({
    lineId: line.id,
    materialId: line.material_id,
    materialCode: line.items?.id || line.material_id || '',
    materialName: line.items?.name || '',
    specification: line.items?.specification || '',
    mpn: line.items?.mpn || '',
    quantity: Number(line.quantity) || 0,
  }))

  return {
    outboundId: record.id,
    outboundNumber: record.id,
    outboundDate: formatMaterialPurchaseOrderDate(record.outbound_date),
    outboundType: normalizeOutboundType(record.outbound_type),
    orderId: record.order_id,
    orderNumber: orderMeta?.orderNumber || record.order_id,
    customer: orderMeta?.customer || '',
    note: record.note || '',
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    createdByName: String(record.created_by_name || '').trim(),
    createdAt: record.created_at,
  }
}

export function groupOutboundsFromRecords(
  records: MaterialOutboundRecord[],
  orderMetaById: Map<string, { orderNumber: string; customer: string }>,
): MaterialOutboundListGroup[] {
  return [...records]
    .map((record) =>
      mapOutboundRecord(record, record.order_id ? orderMetaById.get(record.order_id) : null),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function formatOutboundMaterialSummary(group: MaterialOutboundListGroup) {
  if (!group.items.length) return '-'
  const first = group.items[0]?.materialName.trim() || group.items[0]?.materialCode || '-'
  if (group.items.length === 1) return first
  return `${first} 외 ${group.items.length - 1}건`
}

export function aggregateIssuedByOrderMaterial(
  rows: { order_id: string | null; material_id: string; quantity: number }[],
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const row of rows) {
    const orderId = row.order_id?.trim()
    const materialId = row.material_id?.trim()
    if (!orderId || !materialId) continue
    const quantity = Math.max(0, Number(row.quantity) || 0)
    if (quantity <= 0) continue
    const key = `${orderId}::${materialId}`
    totals.set(key, (totals.get(key) ?? 0) + quantity)
  }
  return totals
}

export function aggregateOutboundByMaterialId(
  lines: { material_id: string; quantity: number }[],
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const line of lines) {
    const materialId = line.material_id?.trim()
    if (!materialId) continue
    const quantity = Math.max(0, Number(line.quantity) || 0)
    if (quantity <= 0) continue
    totals.set(materialId, (totals.get(materialId) ?? 0) + quantity)
  }
  return totals
}

/** 부모 품목 수량 기준으로 원자재·부자재 소요량으로 펼칩니다. filter 지정 시 해당 구분 자재만. */
export function explodeBomToMaterials(
  rootProductId: string,
  rootQuantity: number,
  edgesByParent: Map<string, BomEdge[]>,
  depth = 0,
  filter?: OutboundBucketFilter,
): Map<string, number> {
  const result = new Map<string, number>()
  if (!rootProductId.trim() || rootQuantity <= 0 || depth > 8) return result

  const edges = edgesByParent.get(rootProductId) || []
  for (const edge of edges) {
    const childQty = rootQuantity * Math.max(0, Number(edge.quantityPer) || 0)
    if (childQty <= 0) continue

    if (edge.childItemCategory === 1 || edge.childItemCategory === 2) {
      if (!matchesBucket(edge.childProductId, filter)) continue
      result.set(edge.childProductId, (result.get(edge.childProductId) ?? 0) + childQty)
      continue
    }

    if (edge.childItemCategory === 3 || edge.childItemCategory === 4) {
      const nested = explodeBomToMaterials(edge.childProductId, childQty, edgesByParent, depth + 1, filter)
      for (const [materialId, qty] of nested) {
        result.set(materialId, (result.get(materialId) ?? 0) + qty)
      }
    }
  }

  return result
}

export function buildOutboundNeedRows(input: {
  orders: OrderListGroup[]
  edgesByParent: Map<string, BomEdge[]>
  itemNameById: Map<string, string>
  issuedByOrderMaterial: Map<string, number>
  bucketByMaterialId: Map<string, OutboundMaterialBucket>
}): MaterialOutboundNeedRow[] {
  const rows: MaterialOutboundNeedRow[] = []

  for (const order of input.orders) {
    const materialNeed = new Map<
      string,
      { productId: string; productName: string; productQuantity: number; required: number }
    >()

    for (const item of order.items) {
      const productId = (item.productId || item.productCode || '').trim()
      if (!productId) continue
      const orderQty = Math.max(0, Number(item.quantity) || 0)
      if (orderQty <= 0) continue

      const exploded = explodeBomToMaterials(productId, orderQty, input.edgesByParent)
      for (const [materialId, required] of exploded) {
        const existing = materialNeed.get(materialId)
        if (existing) {
          existing.required += required
          if (existing.productId === productId) {
            existing.productQuantity += orderQty
          }
        } else {
          materialNeed.set(materialId, {
            productId,
            productName: item.productName || productId,
            productQuantity: orderQty,
            required,
          })
        }
      }
    }

    for (const [materialId, need] of materialNeed) {
      const issued = input.issuedByOrderMaterial.get(`${order.orderId}::${materialId}`) ?? 0
      const remaining = Math.max(0, need.required - issued)
      if (remaining <= 0) continue

      rows.push({
        orderId: order.orderId,
        orderNumber: order.orderNumber,
        customer: order.customer,
        deliveryDate: order.deliveryDate || '',
        productId: need.productId,
        productName: need.productName,
        productQuantity: need.productQuantity,
        materialId,
        materialCode: materialId,
        materialName: input.itemNameById.get(materialId) || materialId,
        materialBucket: input.bucketByMaterialId.get(materialId) ?? 'ETC',
        requiredQuantity: need.required,
        issuedQuantity: issued,
        remainingQuantity: remaining,
      })
    }
  }

  return rows.sort((a, b) => {
    const orderCompare = b.orderNumber.localeCompare(a.orderNumber, 'ko')
    if (orderCompare !== 0) return orderCompare
    return a.materialId.localeCompare(b.materialId, 'ko')
  })
}

export function groupNeedRowsByOrder(rows: MaterialOutboundNeedRow[]) {
  const map = new Map<
    string,
    {
      orderId: string
      orderNumber: string
      customer: string
      deliveryDate: string
      productLabel: string
      productQuantity: number
      lines: MaterialOutboundNeedRow[]
      remainingTotal: number
    }
  >()

  for (const row of rows) {
    const existing = map.get(row.orderId)
    if (existing) {
      existing.lines.push(row)
      existing.remainingTotal += row.remainingQuantity
      continue
    }

    map.set(row.orderId, {
      orderId: row.orderId,
      orderNumber: row.orderNumber,
      customer: row.customer,
      deliveryDate: row.deliveryDate,
      productLabel: '',
      productQuantity: 0,
      lines: [row],
      remainingTotal: row.remainingQuantity,
    })
  }

  return [...map.values()].map((group) => {
    const products = new Map<string, { name: string; quantity: number }>()
    for (const line of group.lines) {
      if (!products.has(line.productId)) {
        products.set(line.productId, {
          name: line.productName || line.productId,
          quantity: line.productQuantity,
        })
      }
    }
    const productList = [...products.values()]
    const first = productList[0]
    const productLabel = !first
      ? '—'
      : productList.length === 1
        ? first.name
        : `${first.name} 외 ${productList.length - 1}건`
    const productQuantity = productList.reduce((sum, item) => sum + item.quantity, 0)

    return {
      ...group,
      productLabel,
      productQuantity,
    }
  })
}

/** 현재고·BOM 기준 제품 1대당 불출 가능 대수 (filter 지정 시 해당 구분 자재만 고려) */
export function computeIssuableProductQuantity(
  productId: string,
  remainingProductQty: number,
  edgesByParent: Map<string, BomEdge[]>,
  onHandByMaterialId: Map<string, number>,
  filter?: OutboundBucketFilter,
) {
  const perOne = explodeBomToMaterials(productId, 1, edgesByParent, 0, filter)
  if (!perOne.size) return 0

  let byStock = Number.POSITIVE_INFINITY
  for (const [materialId, qtyPer] of perOne) {
    if (qtyPer <= 0) continue
    byStock = Math.min(byStock, Math.floor((onHandByMaterialId.get(materialId) ?? 0) / qtyPer))
  }
  if (!Number.isFinite(byStock)) return 0
  return Math.max(0, Math.min(remainingProductQty, byStock))
}

export function computeRemainingProductQuantity(
  productId: string,
  productQuantity: number,
  lines: MaterialOutboundNeedRow[],
  edgesByParent: Map<string, BomEdge[]>,
  filter?: OutboundBucketFilter,
) {
  const perOne = explodeBomToMaterials(productId, 1, edgesByParent, 0, filter)
  if (!perOne.size) return Math.max(0, productQuantity)

  let remaining = Number.POSITIVE_INFINITY
  for (const [materialId, qtyPer] of perOne) {
    if (qtyPer <= 0) continue
    const line = lines.find((item) => item.materialId === materialId)
    const remMat = line?.remainingQuantity ?? 0
    remaining = Math.min(remaining, Math.floor(remMat / qtyPer))
  }
  if (!Number.isFinite(remaining)) return 0
  return Math.max(0, Math.min(productQuantity, remaining))
}

export function buildOutboundNeedCards(input: {
  rows: MaterialOutboundNeedRow[]
  edgesByParent: Map<string, BomEdge[]>
  onHandByMaterialId: Map<string, number>
  bucketByMaterialId: Map<string, OutboundMaterialBucket>
}): MaterialOutboundNeedCard[] {
  // 주문×제품×자재구분(SMD/DIP/기타) 단위로 카드 분리
  const map = new Map<string, MaterialOutboundNeedRow[]>()

  for (const row of input.rows) {
    const key = `${row.orderId}::${row.productId}::${row.materialBucket}`
    const list = map.get(key) || []
    list.push(row)
    map.set(key, list)
  }

  const cards: MaterialOutboundNeedCard[] = []

  for (const [key, lines] of map) {
    const first = lines[0]
    if (!first) continue

    const filter: OutboundBucketFilter = {
      bucket: first.materialBucket,
      bucketByMaterialId: input.bucketByMaterialId,
    }

    const remainingProductQuantity = computeRemainingProductQuantity(
      first.productId,
      first.productQuantity,
      lines,
      input.edgesByParent,
      filter,
    )
    if (remainingProductQuantity <= 0) continue

    const issuableQuantity = computeIssuableProductQuantity(
      first.productId,
      remainingProductQuantity,
      input.edgesByParent,
      input.onHandByMaterialId,
      filter,
    )

    cards.push({
      key,
      orderId: first.orderId,
      orderNumber: first.orderNumber,
      customer: first.customer,
      deliveryDate: first.deliveryDate,
      productId: first.productId,
      productName: first.productName || first.productId,
      productQuantity: first.productQuantity,
      materialBucket: first.materialBucket,
      remainingProductQuantity,
      issuableQuantity,
      lines,
    })
  }

  const bucketOrder: Record<string, number> = { SMD: 0, DIP: 1, ETC: 2 }

  return cards.sort((a, b) => {
    const orderCompare = b.orderNumber.localeCompare(a.orderNumber, 'ko')
    if (orderCompare !== 0) return orderCompare
    const productCompare = a.productId.localeCompare(b.productId, 'ko')
    if (productCompare !== 0) return productCompare
    return (bucketOrder[a.materialBucket] ?? 9) - (bucketOrder[b.materialBucket] ?? 9)
  })
}

/** 미불출 액션 카드를 주문서 단위로 묶습니다 (발주 카드와 동일 UX) */
export function buildOutboundOrderCards(
  needCards: MaterialOutboundNeedCard[],
): MaterialOutboundOrderCard[] {
  const map = new Map<string, MaterialOutboundNeedCard[]>()

  for (const card of needCards) {
    const list = map.get(card.orderId) || []
    list.push(card)
    map.set(card.orderId, list)
  }

  const bucketOrder: Record<string, number> = { SMD: 0, DIP: 1, ETC: 2 }

  return [...map.entries()]
    .map(([orderId, actions]) => {
      const first = actions[0]
      if (!first) return null

      const products = new Map<string, string>()
      for (const action of actions) {
        if (!products.has(action.productId)) {
          products.set(action.productId, action.productName || action.productId)
        }
      }
      const productNames = [...products.values()]
      const firstName = productNames[0] || '—'
      const productLabel =
        productNames.length <= 1
          ? firstName
          : `${firstName} 외 ${productNames.length - 1}건`

      const sortedActions = [...actions].sort((a, b) => {
        const productCompare = a.productId.localeCompare(b.productId, 'ko')
        if (productCompare !== 0) return productCompare
        return (bucketOrder[a.materialBucket] ?? 9) - (bucketOrder[b.materialBucket] ?? 9)
      })

      return {
        key: orderId,
        orderId,
        orderNumber: first.orderNumber,
        customer: first.customer,
        deliveryDate: first.deliveryDate,
        productLabel,
        productCount: products.size,
        actions: sortedActions,
        issuableActionCount: sortedActions.filter((item) => item.issuableQuantity > 0).length,
      } satisfies MaterialOutboundOrderCard
    })
    .filter((card): card is MaterialOutboundOrderCard => card != null)
    .sort((a, b) => b.orderNumber.localeCompare(a.orderNumber, 'ko'))
}

export function buildOutboundLinesForProductQuantity(
  productId: string,
  quantity: number,
  edgesByParent: Map<string, BomEdge[]>,
  filter?: OutboundBucketFilter,
) {
  const exploded = explodeBomToMaterials(productId, quantity, edgesByParent, 0, filter)
  return [...exploded.entries()]
    .map(([material_id, qty]) => ({
      material_id,
      quantity: Math.max(0, Number(qty) || 0),
    }))
    .filter((item) => item.material_id && item.quantity > 0)
}


