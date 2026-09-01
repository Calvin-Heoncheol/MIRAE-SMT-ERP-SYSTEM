import type { DeliveryStatementTableGroup } from '@/lib/delivery/history-utils'
import {
  buildShipmentStatementLinesFromHistory,
  type DeliveryBillingOnlyLine,
} from '@/lib/delivery/utils'

export type MonthlyClosingRow = {
  recordDate: string
  productName: string
  quantity: number
  unitPrice: number
  amount: number
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
    if (group.source === 'legacy' && group.legacyGroup) {
      for (const line of group.legacyGroup.lines) {
        const quantity = Math.max(0, Math.floor(Number(line.quantity) || 0))
        const unitPrice = Math.max(0, Math.round(Number(line.unitPrice) || 0))
        const amount = Math.max(0, Math.round(Number(line.amount) || quantity * unitPrice))
        if (quantity <= 0 && amount <= 0) continue
        rows.push({
          recordDate: line.recordDate || group.recordDate,
          productName: line.productName || '—',
          quantity,
          unitPrice,
          amount,
        })
      }
      continue
    }

    if (!group.lines.length) continue

    const statementLines = buildShipmentStatementLinesFromHistory({
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

    for (const line of statementLines) {
      const quantity = Math.max(0, Math.floor(Number(line.qty) || 0))
      const unitPrice = Math.max(0, Math.round(Number(line.unitPrice) || 0))
      const amount = quantity * unitPrice
      if (quantity <= 0 && amount <= 0) continue
      rows.push({
        recordDate: group.recordDate,
        productName: line.productName || '—',
        quantity,
        unitPrice,
        amount,
      })
    }
  }

  return rows.sort((a, b) => {
    const byDate = a.recordDate.localeCompare(b.recordDate)
    if (byDate !== 0) return byDate
    return a.productName.localeCompare(b.productName, 'ko')
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
