export const LEAVE_TYPES = [
  { value: 'annual', label: '연차', order: 1 },
  { value: 'congratulatory', label: '경조휴가', order: 2 },
  { value: 'sick', label: '병가', order: 3 },
  { value: 'early_leave', label: '조퇴', order: 4 },
  { value: 'absence', label: '결근', order: 5 },
  { value: 'other', label: '기타', order: 6 },
] as const

export type LeaveType = (typeof LEAVE_TYPES)[number]['value']

const LEAVE_TYPE_BY_VALUE = new Map(LEAVE_TYPES.map((item) => [item.value, item]))

export function isLeaveType(value: string): value is LeaveType {
  return LEAVE_TYPE_BY_VALUE.has(value as LeaveType)
}

export function getLeaveTypeLabel(value: LeaveType) {
  return LEAVE_TYPE_BY_VALUE.get(value)?.label ?? value
}

export function normalizeLeaveType(value: unknown): LeaveType {
  if (typeof value === 'string' && isLeaveType(value)) return value
  return 'annual'
}
