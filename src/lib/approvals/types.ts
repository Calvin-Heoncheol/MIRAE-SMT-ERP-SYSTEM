import type { ApprovalCategory } from './categories'
import type { ApprovalSignoff } from './signoffs'

export type ApprovalDetailItem = {
  name: string
  model: string
  partNumber: string
  unit: string
  supplier: string
  qty: string
  unitPrice: string
  amount: string
  dueDate: string
  note: string
}

export type ApprovalAttachmentFile = {
  id: string
  name: string
  path: string
  size: number
  mimeType: string
  uploadedAt: string
}

export type ApprovalPaymentType = 'immediate' | 'recurring' | ''
export type ApprovalAmountBasis = 'supply' | 'total' | 'exempt' | ''

export type ApprovalDetailInfo = {
  detailItems: ApprovalDetailItem[]
  amountBasis: ApprovalAmountBasis
  paymentType: ApprovalPaymentType
  paymentMethod: string
  attachments: string
  attachmentFiles: ApprovalAttachmentFile[]
  remarks: string
  signoffs: ApprovalSignoff[]
}

export type ApprovalRecord = {
  id: string
  category: ApprovalCategory
  doc_number: string
  written_date: string
  department: string
  retention_period: string
  author: string
  processing_date: string
  subject: string
  intro_body: string
  total_amount: number
  detail_info: ApprovalDetailInfo
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export type ApprovalListItem = {
  id: string
  category: ApprovalCategory
  docNumber: string
  writtenDate: string
  department: string
  author: string
  createdByName: string
  subject: string
  totalAmount: number
  detailInfo: ApprovalDetailInfo
  introBody: string
  retentionPeriod: string
  processingDate: string
}

export type ApprovalRowPayload = {
  category: ApprovalCategory
  doc_number?: string
  written_date: string
  department: string
  retention_period: string
  author: string
  processing_date: string
  subject: string
  intro_body: string
  total_amount: number
  detail_info: ApprovalDetailInfo
}
