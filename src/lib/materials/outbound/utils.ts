import { formatMaterialPurchaseOrderDate } from '@/lib/materials/purchase-orders/utils'
import type { OrderListGroup } from '@/lib/orders/types'
import type {
  BomEdge,
  MaterialOutboundListGroup,
  MaterialOutboundNeedCard,
  MaterialOutboundNeedRow,
  MaterialOutboundRecord,
  MaterialOutboundType,
} from './types'
import { MATERIAL_OUTBOUND_TYPE_LABELS } from './types'

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

/** 부모 품목 수량 기준으로 원자재·부자재 소요량으로 펼칩니다. */
export function explodeBomToMaterials(
  rootProductId: string,
  rootQuantity: number,
  edgesByParent: Map<string, BomEdge[]>,
  depth = 0,
): Map<string, number> {
  const result = new Map<string, number>()
  if (!rootProductId.trim() || rootQuantity <= 0 || depth > 8) return result

  const edges = edgesByParent.get(rootProductId) || []
  for (const edge of edges) {
    const childQty = rootQuantity * Math.max(0, Number(edge.quantityPer) || 0)
    if (childQty <= 0) continue

    if (edge.childItemCategory === 1 || edge.childItemCategory === 2) {
      result.set(edge.childProductId, (result.get(edge.childProductId) ?? 0) + childQty)
      continue
    }

    if (edge.childItemCategory === 3 || edge.childItemCategory === 4) {
      const nested = explodeBomToMaterials(edge.childProductId, childQty, edgesByParent, depth + 1)
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

/** 현재고·BOM 기준 제품 1대당 불출 가능 대수 */
export function computeIssuableProductQuantity(
  productId: string,
  remainingProductQty: number,
  edgesByParent: Map<string, BomEdge[]>,
  onHandByMaterialId: Map<string, number>,
) {
  const perOne = explodeBomToMaterials(productId, 1, edgesByParent)
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
) {
  const perOne = explodeBomToMaterials(productId, 1, edgesByParent)
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
}): MaterialOutboundNeedCard[] {
  const map = new Map<string, MaterialOutboundNeedRow[]>()

  for (const row of input.rows) {
    const key = `${row.orderId}::${row.productId}`
    const list = map.get(key) || []
    list.push(row)
    map.set(key, list)
  }

  const cards: MaterialOutboundNeedCard[] = []

  for (const [key, lines] of map) {
    const first = lines[0]
    if (!first) continue

    const remainingProductQuantity = computeRemainingProductQuantity(
      first.productId,
      first.productQuantity,
      lines,
      input.edgesByParent,
    )
    if (remainingProductQuantity <= 0) continue

    const issuableQuantity = computeIssuableProductQuantity(
      first.productId,
      remainingProductQuantity,
      input.edgesByParent,
      input.onHandByMaterialId,
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
      remainingProductQuantity,
      issuableQuantity,
      lines,
    })
  }

  return cards.sort((a, b) => {
    const orderCompare = b.orderNumber.localeCompare(a.orderNumber, 'ko')
    if (orderCompare !== 0) return orderCompare
    return a.productId.localeCompare(b.productId, 'ko')
  })
}

export function buildOutboundLinesForProductQuantity(
  productId: string,
  quantity: number,
  edgesByParent: Map<string, BomEdge[]>,
) {
  const exploded = explodeBomToMaterials(productId, quantity, edgesByParent)
  return [...exploded.entries()]
    .map(([material_id, qty]) => ({
      material_id,
      quantity: Math.max(0, Number(qty) || 0),
    }))
    .filter((item) => item.material_id && item.quantity > 0)
}


