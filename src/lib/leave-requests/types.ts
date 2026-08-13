import type { ApprovalSignoff } from '@/lib/approvals/signoffs'
import type { LeaveType } from './leave-types'

export type LeaveRequestAttachmentFile = {
  id: string
  name: string
  path: string
  size: number
  mimeType: string
  uploadedAt: string
}

export type LeaveRequestDetailInfo = {
  attachments: string
  attachmentFiles: LeaveRequestAttachmentFile[]
  signoffs: ApprovalSignoff[]
}

export type LeaveRequestRecord = {
  id: string
  doc_number: string
  written_date: string
  department: string
  position: string
  author: string
  leave_type: LeaveType
  start_date: string | null
  start_time: string
  end_date: string | null
  end_time: string
  reason: string
  detail_info: LeaveRequestDetailInfo
  created_by?: string | null
  created_by_name?: string | null
  created_at: string
  updated_at: string
}

export type LeaveRequestListItem = {
  id: string
  docNumber: string
  writtenDate: string
  department: string
  position: string
  author: string
  createdByName: string
  leaveType: LeaveType
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  reason: string
  detailInfo: LeaveRequestDetailInfo
}

export type LeaveRequestRowPayload = {
  doc_number?: string
  written_date: string
  department: string
  position: string
  author: string
  leave_type: LeaveType
  start_date: string | null
  start_time: string
  end_date: string | null
  end_time: string
  reason: string
  detail_info: LeaveRequestDetailInfo
}
