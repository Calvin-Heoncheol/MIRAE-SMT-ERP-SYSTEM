import { formatSeoulDateInput } from '@/lib/approvals/date'
import { DEFAULT_APPROVAL_DEPARTMENT, normalizeApprovalDepartment } from '@/lib/approvals/departments'
import { createDefaultSignoffs, normalizeSignoffs, resolveApprovalDateFromSignoffs } from '@/lib/approvals/signoffs'
import type { ApprovalSignoff } from '@/lib/approvals/signoffs'
import { normalizeExpenseReportAccountCategory } from './account-categories'
import type { ExpenseReportProcessingMethod } from './processing-methods'
import { normalizeExpenseReportProcessingMethod } from './processing-methods'
import type {
  ExpenseReportAttachmentFile,
  ExpenseReportDetailInfo,
  ExpenseReportLineItem,
  ExpenseReportListItem,
} from './types'

export const EXPENSE_REPORT_DEFAULT_LINE_COUNT = 7

export type ExpenseReportFormState = {
  writtenDate: string
  docNumber: string
  department: string
  processingDetails: ExpenseReportProcessingMethod
  approvalDate: string
  expenditureDate: string
  recipient: string
  receiptDate: string
  lineItems: ExpenseReportLineItem[]
  attachments: string
  attachmentFiles: ExpenseReportAttachmentFile[]
  remarks: string
  signoffs: ApprovalSignoff[]
}

export function defaultExpenseReportLineItem(): ExpenseReportLineItem {
  return {
    accountCategory: '',
    description: '',
    amount: '',
    note: '',
  }
}

export function createDefaultExpenseReportLineItems(count = EXPENSE_REPORT_DEFAULT_LINE_COUNT): ExpenseReportLineItem[] {
  return Array.from({ length: count }, () => defaultExpenseReportLineItem())
}

export function createDefaultExpenseReportForm(): ExpenseReportFormState {
  const today = formatSeoulDateInput()
  return {
    writtenDate: today,
    docNumber: '',
    department: DEFAULT_APPROVAL_DEPARTMENT,
    processingDetails: 'cash',
    approvalDate: '',
    expenditureDate: '',
    recipient: '',
    receiptDate: today,
    lineItems: createDefaultExpenseReportLineItems(),
    attachments: '',
    attachmentFiles: [],
    remarks: '',
    signoffs: createDefaultSignoffs(),
  }
}

function normalizeLineItem(raw: Partial<ExpenseReportLineItem>): ExpenseReportLineItem {
  return {
    accountCategory: normalizeExpenseReportAccountCategory(raw.accountCategory),
    description: String(raw.description ?? ''),
    amount: String(raw.amount ?? ''),
    note: String(raw.note ?? ''),
  }
}

export function expenseReportToForm(report: ExpenseReportListItem): ExpenseReportFormState {
  const lineItems = report.detailInfo.lineItems.length
    ? report.detailInfo.lineItems.map((item) => normalizeLineItem(item))
    : createDefaultExpenseReportLineItems()

  const signoffs = normalizeSignoffs(report.detailInfo.signoffs)

  return {
    writtenDate: report.writtenDate,
    docNumber: report.docNumber || report.id,
    department: normalizeApprovalDepartment(report.department),
    processingDetails: normalizeExpenseReportProcessingMethod(report.processingDetails),
    approvalDate: resolveApprovalDateFromSignoffs(signoffs) || report.approvalDate,
    expenditureDate: report.expenditureDate,
    recipient: report.recipient,
    receiptDate: report.receiptDate || report.writtenDate,
    lineItems,
    attachments: report.detailInfo.attachments,
    attachmentFiles: report.detailInfo.attachmentFiles ?? [],
    remarks: report.detailInfo.remarks,
    signoffs,
  }
}

export function formToDetailInfo(form: ExpenseReportFormState): ExpenseReportDetailInfo {
  return {
    lineItems: form.lineItems,
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

export function computeExpenseReportTotalAmount(form: Pick<ExpenseReportFormState, 'lineItems'>) {
  return form.lineItems.reduce((sum, item) => sum + parseNumericField(item.amount), 0)
}

export function toNullableDate(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}
