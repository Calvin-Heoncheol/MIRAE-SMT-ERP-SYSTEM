import type { ApprovalSignoff } from '@/lib/approvals/signoffs'

export type ExpenseReportLineItem = {
  accountCategory: string
  description: string
  amount: string
  note: string
}

export type ExpenseReportAttachmentFile = {
  id: string
  name: string
  path: string
  size: number
  mimeType: string
  uploadedAt: string
}

export type ExpenseReportDetailInfo = {
  lineItems: ExpenseReportLineItem[]
  attachments: string
  attachmentFiles: ExpenseReportAttachmentFile[]
  remarks: string
  signoffs: ApprovalSignoff[]
}

export type ExpenseReportRecord = {
  id: string
  doc_number: string
  written_date: string
  department: string
  author: string
  account_category: string
  processing_details: string
  approval_date: string | null
  expenditure_date: string | null
  recipient: string
  receipt_date: string | null
  total_amount: number
  detail_info: ExpenseReportDetailInfo
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export type ExpenseReportListItem = {
  id: string
  docNumber: string
  writtenDate: string
  department: string
  author: string
  createdByName: string
  accountCategory: string
  processingDetails: string
  approvalDate: string
  expenditureDate: string
  recipient: string
  receiptDate: string
  totalAmount: number
  detailInfo: ExpenseReportDetailInfo
}

export type ExpenseReportRowPayload = {
  doc_number?: string
  written_date: string
  department: string
  author: string
  account_category: string
  processing_details: string
  approval_date: string | null
  expenditure_date: string | null
  recipient: string
  receipt_date: string | null
  total_amount: number
  detail_info: ExpenseReportDetailInfo
}
