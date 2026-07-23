import type { ApprovalCategory } from './categories'
import type {
  ApprovalAmountBasis,
  ApprovalDetailInfo,
  ApprovalListItem,
  ApprovalPaymentType,
  ApprovalRecord,
} from './types'

import { normalizeApprovalDepartment } from './departments'
import { normalizeSignoffs } from './signoffs'

function normalizeDetailInfo(raw: ApprovalRecord['detail_info']): ApprovalDetailInfo {
  const amountBasis: ApprovalAmountBasis =
    raw?.amountBasis === 'supply' || raw?.amountBasis === 'total' || raw?.amountBasis === 'exempt'
      ? raw.amountBasis
      : 'supply'
  const paymentType: ApprovalPaymentType =
    raw?.paymentType === 'immediate' ? 'immediate' : raw?.paymentType === 'recurring' ? 'recurring' : ''
  return {
    detailItems: Array.isArray(raw?.detailItems) ? raw.detailItems : [],
    amountBasis,
    paymentType,
    paymentMethod: String(raw?.paymentMethod ?? ''),
    attachments: String(raw?.attachments ?? ''),
    attachmentFiles: Array.isArray(raw?.attachmentFiles)
      ? raw.attachmentFiles
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: String((item as { id?: string }).id ?? ''),
            name: String((item as { name?: string }).name ?? ''),
            path: String((item as { path?: string }).path ?? ''),
            size: Number((item as { size?: number }).size) || 0,
            mimeType: String((item as { mimeType?: string }).mimeType ?? ''),
            uploadedAt: String((item as { uploadedAt?: string }).uploadedAt ?? ''),
          }))
          .filter((item) => item.id && item.path && item.name)
      : [],
    remarks: String(raw?.remarks ?? ''),
    signoffs: normalizeSignoffs(raw?.signoffs),
  }
}

export function mapApprovalRecord(record: ApprovalRecord): ApprovalListItem {
  return {
    id: record.id,
    category: record.category,
    docNumber: record.doc_number || record.id,
    writtenDate: record.written_date,
    department: normalizeApprovalDepartment(record.department),
    author: record.author,
    createdByName: String(record.created_by_name || '').trim(),
    subject: record.subject,
    totalAmount: Number(record.total_amount) || 0,
    detailInfo: normalizeDetailInfo(record.detail_info),
    introBody: record.intro_body,
    retentionPeriod: record.retention_period,
    processingDate: record.processing_date,
  }
}

export function sortApprovalsNewestFirst(items: ApprovalListItem[]) {
  return [...items].sort((a, b) => {
    const dateCompare = b.writtenDate.localeCompare(a.writtenDate)
    if (dateCompare !== 0) return dateCompare
    return b.docNumber.localeCompare(a.docNumber)
  })
}

export function filterApprovalsByCategory(items: ApprovalListItem[], category: ApprovalCategory) {
  return items.filter((item) => item.category === category)
}

export function formatApprovalMoney(amount: number) {
  return `₩${Math.round(amount).toLocaleString('ko-KR')}`
}

export { getSignoffStatusLabel } from './signoffs'
