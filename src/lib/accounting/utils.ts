import { addDaysYmd } from '@/lib/orders/utils'
import type { PaymentTermSnapshot } from '@/lib/partners/payment-term-snapshot'
import {
  formatPaymentTermSnapshotLabel,
  isEmptyPaymentTermSnapshot,
  snapshotFromPartner,
} from '@/lib/partners/payment-term-snapshot'
import type { BusinessPartner } from '@/lib/partners/types'
import type { SalesReportStatementGroup } from '@/lib/reports/sales-report'
import type {
  ReceivableRow,
  ReceivableStatus,
  ReceivableStatusFilter,
  StatementPayment,
} from './types'
import { RECEIVABLE_STATUS_LABELS } from './types'

export function computeExpectedPaymentDate(
  issueDate: string,
  terms: Pick<PaymentTermSnapshot, 'paymentTermType' | 'paymentNetDays' | 'paymentMonthlyDay'>,
): string | null {
  const issue = issueDate.slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(issue)) return null

  if (terms.paymentTermType === 'net') {
    return addDaysYmd(issue, Math.max(1, Math.floor(Number(terms.paymentNetDays) || 30)))
  }

  if (terms.paymentTermType === 'monthly') {
    const year = Number(issue.slice(0, 4))
    const month = Number(issue.slice(5, 7))
    let nextYear = year
    let nextMonth = month + 1
    if (nextMonth > 12) {
      nextYear += 1
      nextMonth = 1
    }
    const lastDay = new Date(nextYear, nextMonth, 0).getDate()
    const day = Math.min(Math.max(1, Math.floor(Number(terms.paymentMonthlyDay) || 15)), lastDay)
    return `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  if (terms.paymentTermType === 'installment') {
    return issue
  }

  return null
}

export function resolveReceivableStatus(input: {
  amount: number
  paidAmount: number
  expectedDate: string | null
  today: string
}): ReceivableStatus {
  const amount = Math.max(0, Math.round(Number(input.amount) || 0))
  const paidAmount = Math.max(0, Math.round(Number(input.paidAmount) || 0))
  if (paidAmount >= amount && amount > 0) return 'paid'
  if (paidAmount >= amount && amount === 0) return 'paid'

  const overdue =
    Boolean(input.expectedDate) && input.expectedDate! < input.today && paidAmount < amount
  if (overdue) return 'overdue'
  if (paidAmount > 0) return 'partial'
  return 'unpaid'
}

export function buildReceivableRow(input: {
  group: SalesReportStatementGroup
  partner: BusinessPartner | null
  snapshot?: PaymentTermSnapshot | null
  payments: StatementPayment[]
  today: string
}): ReceivableRow {
  const issueDate = String(input.group.recordDate || '').slice(0, 10)
  const relatedPayments = input.payments
    .filter((payment) => payment.shipmentId === input.group.shipmentId)
    .sort((a, b) => {
      const byDate = b.paidDate.localeCompare(a.paidDate)
      if (byDate !== 0) return byDate
      return b.createdAt.localeCompare(a.createdAt)
    })
  const amount = Math.max(0, Math.round(Number(input.group.amount) || 0))
  const paidAmount = relatedPayments.reduce((sum, payment) => sum + payment.amount, 0)
  const terms = !isEmptyPaymentTermSnapshot(input.snapshot)
    ? input.snapshot!
    : snapshotFromPartner(input.partner)
  const expectedDate = computeExpectedPaymentDate(issueDate, terms)

  return {
    shipmentId: input.group.shipmentId,
    customer: input.group.customer,
    productName: input.group.productName,
    orderNumber: input.group.orderNumber,
    issueDate,
    expectedDate,
    paymentTermType: terms.paymentTermType,
    paymentTermLabel: formatPaymentTermSnapshotLabel(terms),
    amount,
    paidAmount,
    remaining: Math.max(0, amount - paidAmount),
    status: resolveReceivableStatus({
      amount,
      paidAmount,
      expectedDate,
      today: input.today,
    }),
    payments: relatedPayments,
  }
}

export function receivableSearchHaystack(row: ReceivableRow) {
  return [
    row.shipmentId,
    row.customer,
    row.productName,
    row.orderNumber,
    row.issueDate,
    row.expectedDate || '',
    row.paymentTermLabel,
    RECEIVABLE_STATUS_LABELS[row.status],
  ]
    .join(' ')
    .toLowerCase()
}

export function filterReceivableRows(
  rows: ReceivableRow[],
  search: string,
  statusFilter: ReceivableStatusFilter,
) {
  const query = search.trim().toLowerCase()
  return rows.filter((row) => {
    if (statusFilter === 'open' && row.status === 'paid') return false
    if (statusFilter !== 'all' && statusFilter !== 'open' && row.status !== statusFilter) return false
    if (!query) return true
    return receivableSearchHaystack(row).includes(query)
  })
}

export function summarizeReceivables(rows: ReceivableRow[]) {
  return {
    statementAmount: rows.reduce((sum, row) => sum + row.amount, 0),
    paidAmount: rows.reduce((sum, row) => sum + row.paidAmount, 0),
    remainingAmount: rows.reduce((sum, row) => sum + row.remaining, 0),
    overdueAmount: rows
      .filter((row) => row.status === 'overdue')
      .reduce((sum, row) => sum + row.remaining, 0),
  }
}
