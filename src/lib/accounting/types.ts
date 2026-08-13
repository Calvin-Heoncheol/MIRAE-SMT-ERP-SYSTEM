import type { PartnerPaymentTermType } from '@/lib/partners/types'

export type ReceivableStatus = 'unpaid' | 'partial' | 'overdue' | 'paid'

export type ReceivableStatusFilter = 'open' | 'unpaid' | 'partial' | 'overdue' | 'paid' | 'all'

export const RECEIVABLE_STATUS_LABELS: Record<ReceivableStatus, string> = {
  unpaid: '미입금',
  partial: '일부입금',
  overdue: '연체',
  paid: '입금완료',
}

export const RECEIVABLE_STATUS_BADGE_CLASS: Record<ReceivableStatus, string> = {
  unpaid: 'bg-amber-100 text-amber-800',
  partial: 'bg-sky-100 text-sky-800',
  overdue: 'bg-rose-100 text-rose-800',
  paid: 'bg-emerald-100 text-emerald-800',
}

export type StatementPayment = {
  id: string
  shipmentId: string
  paidDate: string
  amount: number
  note: string
  createdByName: string
  createdAt: string
}

export type ReceivableRow = {
  shipmentId: string
  customer: string
  productName: string
  orderNumber: string
  /** 거래명세서 발행일 ≈ 출하일 */
  issueDate: string
  expectedDate: string | null
  paymentTermType: PartnerPaymentTermType
  paymentTermLabel: string
  amount: number
  paidAmount: number
  remaining: number
  status: ReceivableStatus
  payments: StatementPayment[]
}

export type CreateStatementPaymentInput = {
  shipmentId: string
  paidDate: string
  amount: number
  note?: string
}
