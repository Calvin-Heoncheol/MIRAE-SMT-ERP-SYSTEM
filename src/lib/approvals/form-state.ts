import type { ApprovalCategory } from './categories'
import { getApprovalIntroBodyPlaceholder } from './categories'
import { DEFAULT_APPROVAL_DEPARTMENT, normalizeApprovalDepartment } from './departments'
import { formatSeoulDateInput } from './date'
import { createDefaultSignoffs, normalizeSignoffs } from './signoffs'
import type { ApprovalSignoff } from './signoffs'
import type {
  ApprovalAmountBasis,
  ApprovalAttachmentFile,
  ApprovalCurrency,
  ApprovalDetailInfo,
  ApprovalDetailItem,
  ApprovalListItem,
  ApprovalPaymentType,
} from './types'

export type ApprovalFormState = {
  writtenDate: string
  docNumber: string
  department: string
  retentionPeriod: string
  author: string
  processingDate: string
  subject: string
  introBody: string
  detailItems: ApprovalDetailItem[]
  amountBasis: ApprovalAmountBasis
  currency: ApprovalCurrency
  paymentType: ApprovalPaymentType
  paymentMethod: string
  attachments: string
  attachmentFiles: ApprovalAttachmentFile[]
  remarks: string
  signoffs: ApprovalSignoff[]
}

export function defaultApprovalDetailItem(category?: ApprovalCategory): ApprovalDetailItem {
  return {
    name: '',
    model: '',
    partNumber: '',
    unit: '',
    supplier: '',
    qty: '',
    unitPrice: '',
    amount: '',
    dueDate: '',
    note: '',
  }
}

export function createDefaultApprovalForm(category: ApprovalCategory = 'consumables'): ApprovalFormState {
  return {
    writtenDate: formatSeoulDateInput(),
    docNumber: '',
    department: DEFAULT_APPROVAL_DEPARTMENT,
    retentionPeriod: '1년',
    author: '',
    processingDate: '결재 후 즉시',
    subject: '',
    introBody: '',
    detailItems: [defaultApprovalDetailItem(category)],
    amountBasis: 'supply',
    currency: 'KRW',
    paymentType: '',
    paymentMethod: '',
    attachments: '',
    attachmentFiles: [],
    remarks: '',
    signoffs: createDefaultSignoffs(),
  }
}

function normalizeDetailItem(raw: Partial<ApprovalDetailItem>): ApprovalDetailItem {
  const model = String(raw.model ?? raw.partNumber ?? '')
  return {
    name: String(raw.name ?? ''),
    model,
    partNumber: String(raw.partNumber ?? model),
    unit: String(raw.unit ?? ''),
    supplier: String(raw.supplier ?? ''),
    qty: String(raw.qty ?? ''),
    unitPrice: String(raw.unitPrice ?? ''),
    amount: String(raw.amount ?? ''),
    dueDate: String(raw.dueDate ?? ''),
    note: String(raw.note ?? ''),
  }
}

export function approvalToForm(approval: ApprovalListItem): ApprovalFormState {
  const department = normalizeApprovalDepartment(approval.department)
  return {
    writtenDate: approval.writtenDate,
    docNumber: approval.docNumber || approval.id,
    department,
    retentionPeriod: approval.retentionPeriod,
    author: approval.author,
    processingDate: approval.processingDate,
    subject: approval.subject,
    introBody: approval.introBody,
    detailItems: approval.detailInfo.detailItems.length
      ? approval.detailInfo.detailItems.map((item) => normalizeDetailItem(item))
      : [defaultApprovalDetailItem(approval.category)],
    amountBasis: normalizeAmountBasis(approval.detailInfo.amountBasis),
    currency: normalizeApprovalCurrency(approval.detailInfo.currency),
    paymentType: normalizePaymentType(approval.detailInfo.paymentType),
    paymentMethod: approval.detailInfo.paymentMethod,
    attachments: approval.detailInfo.attachments,
    attachmentFiles: approval.detailInfo.attachmentFiles ?? [],
    remarks: approval.detailInfo.remarks,
    signoffs: normalizeSignoffs(approval.detailInfo.signoffs),
  }
}

export function formToDetailInfo(form: ApprovalFormState): ApprovalDetailInfo {
  return {
    detailItems: form.detailItems,
    amountBasis: form.amountBasis,
    currency: form.currency,
    paymentType: form.paymentType,
    paymentMethod: form.paymentType === 'immediate' ? form.paymentMethod : '',
    attachments: form.attachments,
    attachmentFiles: form.attachmentFiles,
    remarks: form.remarks,
    signoffs: form.signoffs,
  }
}

function normalizeAmountBasis(value: unknown): ApprovalAmountBasis {
  if (value === 'supply' || value === 'total' || value === 'exempt') return value
  return 'supply'
}

export function normalizeApprovalCurrency(value: unknown): ApprovalCurrency {
  return String(value || '').trim().toUpperCase() === 'USD' ? 'USD' : 'KRW'
}

function normalizePaymentType(value: unknown): ApprovalPaymentType {
  if (value === 'immediate' || value === 'recurring') return value
  return ''
}

export function parseNumericField(value: string) {
  const trimmed = value.trim()
  if (trimmed === '' || trimmed === '-') return 0
  const parsed = Number(trimmed.replace(/,/g, ''))
  if (Number.isNaN(parsed)) return 0
  return parsed
}

export function computeLineAmount(qty: string, unitPrice: string) {
  const quantity = parseNumericField(qty)
  const price = parseNumericField(unitPrice)
  if (quantity <= 0 || price <= 0) return ''
  return String(quantity * price)
}

function computeSupplyFromEnteredAmount(
  amount: number,
  amountBasis: ApprovalAmountBasis,
  currency: ApprovalCurrency = 'KRW',
) {
  if (amount <= 0) return 0
  if (currency === 'USD') return amount
  if (amountBasis === 'total') return Math.round((amount / (1 + APPROVAL_VAT_RATE)) * 100) / 100
  return amount
}

export const APPROVAL_VAT_RATE = 0.1

/** 달러(USD) 품의는 국내 부가세 없음 */
export function approvalAppliesVat(
  form?: Pick<ApprovalFormState, 'currency' | 'amountBasis'>,
  category?: ApprovalCategory,
) {
  if (category === 'duty-tax') return true
  if (!form) return true
  if (form.currency === 'USD') return false
  return form.amountBasis !== 'exempt'
}

export function computeApprovalSupplyAmount(
  form: Pick<ApprovalFormState, 'detailItems' | 'amountBasis' | 'currency'>,
  category?: ApprovalCategory,
) {
  if (category === 'duty-tax') {
    return form.detailItems.reduce((sum, item) => sum + parseNumericField(item.unitPrice), 0)
  }
  const currency = form.currency === 'USD' ? 'USD' : 'KRW'
  return form.detailItems.reduce((sum, item) => {
    const amount = parseNumericField(item.amount)
    if (amount > 0) return sum + computeSupplyFromEnteredAmount(amount, form.amountBasis, currency)
    return (
      sum +
      computeSupplyFromEnteredAmount(
        parseNumericField(item.qty) * parseNumericField(item.unitPrice),
        form.amountBasis,
        currency,
      )
    )
  }, 0)
}

export function computeApprovalVatAmount(
  supplyAmount: number,
  category?: ApprovalCategory,
  form?: Pick<ApprovalFormState, 'detailItems' | 'amountBasis' | 'currency'>,
) {
  if (category === 'duty-tax' && form) {
    return form.detailItems.reduce((sum, item) => sum + parseNumericField(item.amount), 0)
  }
  if (!approvalAppliesVat(form, category)) return 0
  if (form?.amountBasis === 'total' && form) {
    const grandTotal = form.detailItems.reduce((sum, item) => {
      const amount = parseNumericField(item.amount)
      if (amount > 0) return sum + amount
      return sum + parseNumericField(item.qty) * parseNumericField(item.unitPrice)
    }, 0)
    return Math.max(0, grandTotal - supplyAmount)
  }
  if (supplyAmount <= 0) return 0
  return Math.round(supplyAmount * APPROVAL_VAT_RATE)
}

export function computeApprovalGrandTotal(
  form: Pick<ApprovalFormState, 'detailItems' | 'amountBasis' | 'currency'>,
  category?: ApprovalCategory,
) {
  const supplyAmount = computeApprovalSupplyAmount(form, category)
  if (category === 'duty-tax') {
    return supplyAmount + computeApprovalVatAmount(supplyAmount, category, form)
  }
  if (!approvalAppliesVat(form, category)) {
    return supplyAmount
  }
  if (form.amountBasis === 'total') {
    return form.detailItems.reduce((sum, item) => {
      const amount = parseNumericField(item.amount)
      if (amount > 0) return sum + amount
      return sum + parseNumericField(item.qty) * parseNumericField(item.unitPrice)
    }, 0)
  }
  return supplyAmount + computeApprovalVatAmount(supplyAmount, category, form)
}

/** DB total_amount — 공급가액 + 부가세(적용 시) */
export function computeApprovalTotalAmount(
  form: Pick<ApprovalFormState, 'detailItems' | 'amountBasis' | 'currency'>,
  category?: ApprovalCategory,
) {
  return computeApprovalGrandTotal(form, category)
}
