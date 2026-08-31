import { buildDeliveryStatementDataFromShipment } from '@/lib/delivery/print-delivery-statement'
import type { DeliveryStatementData } from '@/lib/delivery/types'
import type { DeliveryStatementTableGroup } from '@/lib/delivery/history-utils'
import {
  buildShipmentStatementLinesFromHistory,
  type DeliveryBillingOnlyLine,
} from '@/lib/delivery/utils'

type BuildStatementContext = {
  unitPriceByDeliveryId: Record<string, number>
  billingOnlyLines: DeliveryBillingOnlyLine[]
  productionOrders: Array<{
    assemblyGroupId?: string
    orderNumber: string
    productId?: string
    productCode: string
    productName: string
    unitPrice: number
  }>
}

export async function buildDeliveryStatementDataFromTableGroup(
  group: DeliveryStatementTableGroup,
  context: BuildStatementContext,
): Promise<{ ok: true; data: DeliveryStatementData } | { ok: false; detail: string }> {
  if (!group.customer.trim()) {
    return { ok: false, detail: `${group.shipmentId}: 고객사 정보가 없습니다.` }
  }

  if (group.source === 'legacy') {
    const legacy = group.legacyGroup
    if (!legacy?.lines.length) {
      return { ok: false, detail: `${group.shipmentId}: 과거 명세 품목이 없습니다.` }
    }
    return buildDeliveryStatementDataFromShipment({
      shipmentId: legacy.shipmentId,
      shipDate: legacy.recordDate,
      customer: legacy.customer,
      shippedLines: legacy.lines.map((line) => ({
        orderNumber: line.orderNumber,
        productCode: line.productCode,
        productName: line.productName,
        qty: line.quantity,
        unitPrice: line.unitPrice,
        orderLineId: line.orderLineId,
      })),
    })
  }

  if (!group.lines.length) {
    return { ok: false, detail: `${group.shipmentId}: 출하 품목이 없습니다.` }
  }

  const shippedLines = buildShipmentStatementLinesFromHistory({
    lines: group.lines.map((line) => ({
      id: line.id,
      orderNumber: line.orderNumber,
      assemblyGroupId: line.assemblyGroupId,
      productId: line.productId,
      productCode: line.productCode,
      productName: line.productName,
      quantity: line.quantity,
    })),
    unitPriceByDeliveryId: context.unitPriceByDeliveryId,
    billingOnlyLines: context.billingOnlyLines,
    productionOrders: context.productionOrders,
  })

  if (!shippedLines.length) {
    return { ok: false, detail: `${group.shipmentId}: 명세서 품목을 만들 수 없습니다.` }
  }

  return buildDeliveryStatementDataFromShipment({
    shipmentId: group.shipmentId,
    shipDate: group.recordDate,
    customer: group.customer,
    note: group.lines.find((line) => line.note.trim())?.note || '',
    shippedLines: shippedLines.map((line) => ({
      orderNumber: line.orderNumber,
      productCode: line.productCode,
      productName: line.productName,
      qty: line.qty,
      unitPrice: line.unitPrice ?? 0,
      billingOnly: line.billingOnly,
      orderLineId: line.orderLineId,
    })),
  })
}
