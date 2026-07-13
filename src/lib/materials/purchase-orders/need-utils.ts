import type { BomEdge } from '@/lib/materials/outbound/types'
import { explodeBomToMaterials } from '@/lib/materials/outbound/utils'
import type { Material } from '@/lib/materials/types'
import type { OrderListGroup } from '@/lib/orders/types'
import type { MaterialPurchaseNeedCard, MaterialPurchaseNeedLine } from './types'

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

function formatProductLabel(order: OrderListGroup) {
  const products = new Map<string, { name: string; quantity: number }>()
  for (const item of order.items) {
    if (item.derivedFromLineId) continue
    const id = (item.productId || item.productCode || '').trim()
    if (!id) continue
    const existing = products.get(id)
    const quantity = Math.max(0, Number(item.quantity) || 0)
    if (existing) {
      existing.quantity += quantity
    } else {
      products.set(id, {
        name: item.productName || id,
        quantity,
      })
    }
  }

  const list = [...products.values()]
  if (!list.length) return { label: '—', quantity: 0 }
  const first = list[0]
  const label = list.length === 1 ? first.name : `${first.name} 외 ${list.length - 1}건`
  const quantity = list.reduce((sum, item) => sum + item.quantity, 0)
  return { label, quantity }
}

export function buildPurchaseNeedCards(input: {
  orders: OrderListGroup[]
  bomEdges: BomEdge[]
  materials: Material[]
  onHandByMaterialId: Map<string, number>
}): MaterialPurchaseNeedCard[] {
  const edgesByParent = buildEdgesByParent(input.bomEdges)
  const materialById = new Map(input.materials.map((material) => [material.id, material]))
  const cards: MaterialPurchaseNeedCard[] = []

  for (const order of input.orders) {
    const requiredByMaterial = new Map<string, number>()

    for (const item of order.items) {
      if (item.derivedFromLineId) continue
      const productId = (item.productId || item.productCode || '').trim()
      const quantity = Math.max(0, Number(item.quantity) || 0)
      if (!productId || quantity <= 0) continue

      const exploded = explodeBomToMaterials(productId, quantity, edgesByParent)
      for (const [materialId, required] of exploded) {
        requiredByMaterial.set(materialId, (requiredByMaterial.get(materialId) ?? 0) + required)
      }
    }

    if (!requiredByMaterial.size) continue

    const lines: MaterialPurchaseNeedLine[] = [...requiredByMaterial.entries()]
      .map(([materialId, requiredQuantity]) => {
        const material = materialById.get(materialId)
        const onHandQuantity = input.onHandByMaterialId.get(materialId) ?? 0
        const shortageQuantity = Math.max(0, requiredQuantity - onHandQuantity)
        return {
          materialId,
          materialCode: materialId,
          materialName: material?.materialName || materialId,
          specification: material?.specification || '',
          mpn: material?.mpn || '',
          supplier: material?.supplier || '',
          unitPrice: material?.unitPrice || 0,
          requiredQuantity,
          onHandQuantity,
          shortageQuantity,
          status: shortageQuantity > 0 ? ('부족' as const) : ('충분' as const),
        }
      })
      .sort((a, b) => {
        if (a.status !== b.status) return a.status === '부족' ? -1 : 1
        return a.materialName.localeCompare(b.materialName, 'ko')
      })

    const { label, quantity } = formatProductLabel(order)
    const shortageCount = lines.filter((line) => line.status === '부족').length

    cards.push({
      key: order.orderId,
      orderId: order.orderId,
      orderNumber: order.orderNumber,
      customer: order.customer,
      deliveryDate: order.deliveryDate || '',
      orderDate: order.orderDate || '',
      productLabel: label,
      productQuantity: quantity,
      materialCount: lines.length,
      shortageCount,
      sufficientCount: lines.length - shortageCount,
      lines,
    })
  }

  return cards.sort((a, b) => {
    if (a.shortageCount !== b.shortageCount) return b.shortageCount - a.shortageCount
    const deliveryCompare = (a.deliveryDate || '').localeCompare(b.deliveryDate || '')
    if (deliveryCompare !== 0) return deliveryCompare
    return b.orderNumber.localeCompare(a.orderNumber, 'ko')
  })
}
