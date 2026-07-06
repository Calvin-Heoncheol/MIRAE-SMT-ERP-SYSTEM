import type { ApprovalAttachmentFile, ApprovalDetailInfo, ApprovalDetailItem, ApprovalListItem } from './types'
import { DEFAULT_APPROVAL_DEPARTMENT, normalizeApprovalDepartment } from './departments'
import { formatSeoulDateInput } from './date'
import { createDefaultSignoffs, normalizeSignoffs } from './signoffs'
import type { ApprovalSignoff } from './signoffs'

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
  paymentMethod: string
  attachments: string
  attachmentFiles: ApprovalAttachmentFile[]
  remarks: string
  signoffs: ApprovalSignoff[]
}

export function defaultApprovalDetailItem(): ApprovalDetailItem {
  return {
    name: '',
    model: '',
    qty: '',
    unitPrice: '',
    amount: '',
    dueDate: '',
    note: '',
  }
}

export function createDefaultApprovalForm(): ApprovalFormState {
  return {
    writtenDate: formatSeoulDateInput(),
    docNumber: '',
    department: DEFAULT_APPROVAL_DEPARTMENT,
    retentionPeriod: '1년',
    author: '',
    processingDate: '결재 후 즉시',
    subject: '',
    introBody: '품의 드리오니 검토 후 재가 바랍니다.',
    detailItems: [defaultApprovalDetailItem()],
    paymentMethod: '',
    attachments: '',
    attachmentFiles: [],
    remarks: '',
    signoffs: createDefaultSignoffs(),
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
      ? approval.detailInfo.detailItems
      : [defaultApprovalDetailItem()],
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
    paymentMethod: form.paymentMethod,
    attachments: form.attachments,
    attachmentFiles: form.attachmentFiles,
    remarks: form.remarks,
    signoffs: form.signoffs,
  }
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

export function computeApprovalTotalAmount(form: ApprovalFormState) {
  return form.detailItems.reduce((sum, item) => {
    const amount = parseNumericField(item.amount)
    if (amount > 0) return sum + amount
    return sum + parseNumericField(item.qty) * parseNumericField(item.unitPrice)
  }, 0)
}
