import { normalizeApprovalDepartment } from '@/lib/approvals/departments'
import { normalizeLeaveType } from './leave-types'
import { normalizeLeaveSignoffs } from './signoffs'
import type { LeaveRequestListItem, LeaveRequestRecord } from './types'

function normalizeDetailInfo(raw: LeaveRequestRecord['detail_info']) {
  return {
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
    signoffs: normalizeLeaveSignoffs(raw?.signoffs),
  }
}

export function mapLeaveRequestRecord(record: LeaveRequestRecord): LeaveRequestListItem {
  return {
    id: record.id,
    docNumber: record.doc_number || record.id,
    writtenDate: record.written_date,
    department: normalizeApprovalDepartment(record.department),
    position: record.position,
    author: record.author,
    createdByName: String(record.created_by_name || '').trim(),
    leaveType: normalizeLeaveType(record.leave_type),
    startDate: record.start_date ?? '',
    startTime: record.start_time,
    endDate: record.end_date ?? '',
    endTime: record.end_time,
    reason: record.reason,
    detailInfo: normalizeDetailInfo(record.detail_info),
  }
}

export function sortLeaveRequestsNewestFirst(items: LeaveRequestListItem[]) {
  return [...items].sort((a, b) => {
    const dateCompare = b.writtenDate.localeCompare(a.writtenDate)
    if (dateCompare !== 0) return dateCompare
    return b.docNumber.localeCompare(a.docNumber)
  })
}

export { getSignoffStatusLabel } from '@/lib/approvals/signoffs'
export { getLeaveTypeLabel } from './leave-types'
