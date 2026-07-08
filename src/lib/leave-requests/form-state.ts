import { formatSeoulDateInput } from '@/lib/approvals/date'
import { DEFAULT_APPROVAL_DEPARTMENT, normalizeApprovalDepartment } from '@/lib/approvals/departments'
import type { ApprovalSignoff } from '@/lib/approvals/signoffs'
import { normalizeLeaveType, type LeaveType } from './leave-types'
import { createDefaultLeaveSignoffs, normalizeLeaveSignoffs } from './signoffs'
import type { LeaveRequestAttachmentFile, LeaveRequestDetailInfo, LeaveRequestListItem } from './types'

export type LeaveRequestFormState = {
  writtenDate: string
  docNumber: string
  department: string
  position: string
  author: string
  leaveType: LeaveType
  startDate: string
  startTime: string
  endDate: string
  endTime: string
  reason: string
  attachments: string
  attachmentFiles: LeaveRequestAttachmentFile[]
  signoffs: ApprovalSignoff[]
}

export function createDefaultLeaveRequestForm(): LeaveRequestFormState {
  const today = formatSeoulDateInput()
  return {
    writtenDate: today,
    docNumber: '',
    department: DEFAULT_APPROVAL_DEPARTMENT,
    position: '',
    author: '',
    leaveType: 'annual',
    startDate: today,
    startTime: '09:00',
    endDate: today,
    endTime: '18:00',
    reason: '',
    attachments: '',
    attachmentFiles: [],
    signoffs: createDefaultLeaveSignoffs(),
  }
}

function normalizeTime(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const match = trimmed.match(/^(\d{1,2}):(\d{2})/)
  if (!match) return trimmed
  return `${match[1].padStart(2, '0')}:${match[2]}`
}

export function leaveRequestToForm(request: LeaveRequestListItem): LeaveRequestFormState {
  return {
    writtenDate: request.writtenDate,
    docNumber: request.docNumber || request.id,
    department: normalizeApprovalDepartment(request.department),
    position: request.position,
    author: request.author,
    leaveType: normalizeLeaveType(request.leaveType),
    startDate: request.startDate || request.writtenDate,
    startTime: normalizeTime(request.startTime),
    endDate: request.endDate || request.writtenDate,
    endTime: normalizeTime(request.endTime),
    reason: request.reason,
    attachments: request.detailInfo.attachments,
    attachmentFiles: request.detailInfo.attachmentFiles ?? [],
    signoffs: normalizeLeaveSignoffs(request.detailInfo.signoffs),
  }
}

export function formToDetailInfo(form: LeaveRequestFormState): LeaveRequestDetailInfo {
  return {
    attachments: form.attachments,
    attachmentFiles: form.attachmentFiles,
    signoffs: form.signoffs,
  }
}

export function toNullableDate(value: string) {
  const trimmed = value.trim()
  return trimmed || null
}

export function formatLeavePeriodLabel(form: Pick<LeaveRequestFormState, 'startDate' | 'startTime' | 'endDate' | 'endTime'>) {
  const start = [form.startDate, form.startTime].filter(Boolean).join(' ').trim()
  const end = [form.endDate, form.endTime].filter(Boolean).join(' ').trim()
  if (!start && !end) return '-'
  return `${start} ~ ${end}`
}

export function buildLeaveTimeFields(form: LeaveRequestFormState) {
  return {
    start_date: toNullableDate(form.startDate),
    start_time: normalizeTime(form.startTime),
    end_date: toNullableDate(form.endDate),
    end_time: normalizeTime(form.endTime),
  }
}
