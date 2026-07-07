import type { ApprovalCategory } from './categories'
import { getApprovalIntroBodyPlaceholder } from './categories'
import { DEFAULT_APPROVAL_DEPARTMENT, normalizeApprovalDepartment } from './departments'
import { formatSeoulDateInput } from './date'
import { createDefaultSignoffs, normalizeSignoffs } from './signoffs'
import type { ApprovalSignoff } from './signoffs'
import type {
  ApprovalAmountBasis,
  ApprovalAttachmentFile,
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

function computeSupplyFromEnteredAmount(amount: number, amountBasis: ApprovalAmountBasis) {
  if (amount <= 0) return 0
  if (amountBasis === 'total') return Math.round((amount / (1 + APPROVAL_VAT_RATE)) * 100) / 100
  return amount
}

export const APPROVAL_VAT_RATE = 0.1

export function computeApprovalSupplyAmount(
  form: Pick<ApprovalFormState, 'detailItems' | 'amountBasis'>,
  category?: ApprovalCategory,
) {
  if (category === 'duty-tax') {
    return form.detailItems.reduce((sum, item) => sum + parseNumericField(item.unitPrice), 0)
  }
  return form.detailItems.reduce((sum, item) => {
    const amount = parseNumericField(item.amount)
    if (amount > 0) return sum + computeSupplyFromEnteredAmount(amount, form.amountBasis)
    return sum + computeSupplyFromEnteredAmount(parseNumericField(item.qty) * parseNumericField(item.unitPrice), form.amountBasis)
  }, 0)
}

export function computeApprovalVatAmount(supplyAmount: number, category?: ApprovalCategory, form?: Pick<ApprovalFormState, 'detailItems'>) {
  if (category === 'duty-tax' && form) {
    return form.detailItems.reduce((sum, item) => sum + parseNumericField(item.amount), 0)
  }
  if (supplyAmount <= 0) return 0
  return Math.round(supplyAmount * APPROVAL_VAT_RATE)
}

export function computeApprovalGrandTotal(
  form: Pick<ApprovalFormState, 'detailItems' | 'amountBasis'>,
  category?: ApprovalCategory,
) {
  const supplyAmount = computeApprovalSupplyAmount(form, category)
  if (category === 'duty-tax') {
    return supplyAmount + computeApprovalVatAmount(supplyAmount, category, form)
  }
  if (form.amountBasis === 'exempt') {
    return supplyAmount
  }
  if (form.amountBasis === 'total') {
    return form.detailItems.reduce((sum, item) => {
      const amount = parseNumericField(item.amount)
      if (amount > 0) return sum + amount
      return sum + parseNumericField(item.qty) * parseNumericField(item.unitPrice)
    }, 0)
  }
  return supplyAmount + computeApprovalVatAmount(supplyAmount)
}

/** DB total_amount — 공급가액 + 부가세(10%) */
export function computeApprovalTotalAmount(
  form: Pick<ApprovalFormState, 'detailItems' | 'amountBasis'>,
  category?: ApprovalCategory,
) {
  return computeApprovalGrandTotal(form, category)
}
