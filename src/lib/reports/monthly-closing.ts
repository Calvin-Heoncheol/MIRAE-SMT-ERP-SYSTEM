import type { DeliveryStatementTableGroup } from '@/lib/delivery/history-utils'
import {
  deliveryRegisterLineKindLabel,
  filterSkippedBillingLines,
  firstShipmentExtraLinesFromNotes,
  isExtrasOnlyDeliveryStub,
  shipmentSkippedBillingKeysFromNotes,
  type DeliveryRegisterLineKind,
} from '@/lib/delivery/register-form'
import {
  buildShipmentStatementLinesFromHistory,
  type DeliveryBillingOnlyLine,
} from '@/lib/delivery/utils'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import { DOMESTIC_VAT_RATE } from '@/lib/quotes/format'

export type MonthlyClosingRow = {
  recordDate: string
  /** 발주번호 (고객 PO). 없으면 발주ID */
  orderNumber: string
  shipmentId: string
  customer: string
  kind: DeliveryRegisterLineKind
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  amount: number
  /** true면 unitPrice·amount가 VAT 포함 금액 */
  vatIncluded?: boolean
}

export function monthlyClosingKindLabel(kind: DeliveryRegisterLineKind) {
  return deliveryRegisterLineKindLabel(kind)
}

const KIND_ORDER: Record<DeliveryRegisterLineKind, number> = {
  product: 0,
  additional_work: 1,
  material: 2,
}

type BuildMonthlyClosingContext = {
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

export function buildMonthlyClosingRows(
  groups: DeliveryStatementTableGroup[],
  context: BuildMonthlyClosingContext,
): MonthlyClosingRow[] {
  const rows: MonthlyClosingRow[] = []

  for (const group of groups) {
    const shipmentId = String(group.shipmentId || '').trim()
    const customer = String(group.customer || '').trim()
    if (group.source === 'legacy' && group.legacyGroup) {
      for (const line of group.legacyGroup.lines) {
        const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0))
        const unitPrice = Math.max(0, Math.round(Number(line.unitPrice) || 0))
        const amount = Math.max(0, Math.round(Number(line.amount) || quantity * unitPrice))
        if (quantity <= 0 && amount <= 0) continue
        rows.push({
          recordDate: line.recordDate || group.recordDate,
          orderNumber: String(line.orderNumber || '').trim(),
          shipmentId,
          customer,
          kind: 'product',
          productCode: String(line.productCode || '').trim(),
          productName: line.productName || '—',
          quantity,
          unitPrice,
          amount,
        })
      }
      continue
    }

    if (!group.lines.length) continue

    const poByOrderId = new Map<string, string>()
    for (const line of group.lines) {
      const orderId = line.orderNumber.trim()
      if (orderId && !poByOrderId.get(orderId)) poByOrderId.set(orderId, line.customerPoNumber.trim())
    }
    const displayPo = (orderId?: string) => {
      const id = String(orderId || '').trim()
      return displayOrderPoNumber(poByOrderId.get(id), id)
    }

    const productHistoryLines = group.lines.filter((line) => !isExtrasOnlyDeliveryStub(line))
    const statementLines = buildShipmentStatementLinesFromHistory({
      lines: productHistoryLines.map((line) => ({
        id: line.id,
        orderNumber: line.orderNumber,
        assemblyGroupId: line.assemblyGroupId,
        productId: line.productId,
        productCode: line.productCode,
        productName: line.productName,
        quantity: line.quantity,
      })),
      unitPriceByDeliveryId: context.unitPriceByDeliveryId,
      billingOnlyLines: filterSkippedBillingLines(
        context.billingOnlyLines,
        shipmentSkippedBillingKeysFromNotes(group.lines.map((line) => line.note)),
      ),
      productionOrders: context.productionOrders,
    })

    for (const line of statementLines) {
      const quantity = Math.max(0, Math.floor(Number(line.qty) || 0))
      const unitPrice = Math.max(0, Math.round(Number(line.unitPrice) || 0))
      const amount = quantity * unitPrice
      if (quantity <= 0 && amount <= 0) continue
      rows.push({
        recordDate: group.recordDate,
        orderNumber: displayPo(line.orderNumber),
        shipmentId,
        customer,
        kind: line.billingOnly ? (line.material ? 'material' : 'additional_work') : 'product',
        productCode: String(line.productCode || '').trim(),
        productName: line.productName || '—',
        quantity,
        unitPrice,
        amount,
      })
    }

    for (const extra of firstShipmentExtraLinesFromNotes(group.lines.map((line) => line.note))) {
      const quantity = Math.max(0, Math.floor(Number(extra.qty) || 0))
      const unitPrice = Math.max(0, Math.round(Number(extra.unitPrice) || 0))
      if (quantity <= 0) continue
      rows.push({
        recordDate: group.recordDate,
        orderNumber: displayPo(extra.orderNumber),
        shipmentId,
        customer,
        kind: extra.lineKind,
        productCode: String(extra.productCode || '').trim(),
        productName: extra.productName || '—',
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
      })
    }
  }

  return rows.sort((a, b) => {
    const byDate = a.recordDate.localeCompare(b.recordDate)
    if (byDate !== 0) return byDate
    const byShipment = a.shipmentId.localeCompare(b.shipmentId)
    if (byShipment !== 0) return byShipment
    const byKind = KIND_ORDER[a.kind] - KIND_ORDER[b.kind]
    if (byKind !== 0) return byKind
    const byCode = a.productCode.localeCompare(b.productCode, 'ko')
    if (byCode !== 0) return byCode
    return a.productName.localeCompare(b.productName, 'ko')
  })
}

/** 거래처 등록에서 VAT 포함인 고객사 행은 단가·합계를 VAT 포함 금액으로 바꾼다 (거래명세서와 같은 반올림) */
export function applyMonthlyClosingVat(
  rows: MonthlyClosingRow[],
  isVatIncludedCustomer: (customer: string) => boolean,
): MonthlyClosingRow[] {
  return rows.map((row) => {
    if (!isVatIncludedCustomer(row.customer)) return row
    return {
      ...row,
      unitPrice: row.unitPrice + Math.round(row.unitPrice * DOMESTIC_VAT_RATE),
      amount: row.amount + Math.round(row.amount * DOMESTIC_VAT_RATE),
      vatIncluded: true,
    }
  })
}

export function summarizeMonthlyClosingRows(rows: MonthlyClosingRow[]) {
  let quantity = 0
  let amount = 0
  for (const row of rows) {
    quantity += row.quantity
    amount += row.amount
  }
  return { quantity, amount, lineCount: rows.length }
}

/** 필터된 명세 묶음·검색어에서 PDF 제목용 고객사명을 추론 */
export function resolveMonthlyClosingCustomerLabel(
  groups: Array<{ customer: string }>,
  search?: string,
): string {
  const customers = [...new Set(groups.map((group) => group.customer.trim()).filter(Boolean))]
  if (customers.length === 1) return customers[0]!

  const query = String(search || '').trim()
  if (query) {
    const exact = customers.find((name) => name === query)
    if (exact) return exact
    const partial = customers.find((name) => name.includes(query) || query.includes(name))
    if (partial) return partial
    return query
  }

  return customers[0] || ''
}
