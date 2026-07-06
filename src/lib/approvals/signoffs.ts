export const APPROVAL_SIGNOFF_STEPS = [
  { role: 'draft', label: '작성', auto: true },
  { role: 'review1', label: '검토1' },
  { role: 'review2', label: '검토2' },
  { role: 'review3', label: '검토3' },
  { role: 'approval', label: '승인' },
] as const

export type ApprovalSignoffRole = (typeof APPROVAL_SIGNOFF_STEPS)[number]['role']

export type ApprovalSignoff = {
  role: ApprovalSignoffRole
  label: string
  status: 'pending' | 'approved'
  approverName?: string
  approvedAt?: string
}

export const APPROVER_NAME_STORAGE_KEY = 'mirae-approval-signer-name'

const LEGACY_ROLE_MAP: Record<string, ApprovalSignoffRole> = {
  draft: 'draft',
  review1: 'review1',
  review2: 'review2',
  review3: 'review3',
  approval: 'approval',
  manager: 'review1',
  director: 'review2',
  executive: 'review3',
  ceo: 'approval',
}

export function isAutoSignoffRole(role: ApprovalSignoffRole) {
  const step = APPROVAL_SIGNOFF_STEPS.find((entry) => entry.role === role)
  return step !== undefined && 'auto' in step && step.auto === true
}

export function createDefaultSignoffs(): ApprovalSignoff[] {
  return APPROVAL_SIGNOFF_STEPS.map((step) => ({
    role: step.role,
    label: step.label,
    status: 'pending',
  }))
}

function resolveSignoffRole(rawRole: string): ApprovalSignoffRole | null {
  return LEGACY_ROLE_MAP[rawRole] ?? null
}

export function normalizeSignoffs(raw: unknown): ApprovalSignoff[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return createDefaultSignoffs()
  }

  const byRole = new Map<ApprovalSignoffRole, ApprovalSignoff>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const mappedRole = resolveSignoffRole(String((item as ApprovalSignoff).role ?? ''))
    if (!mappedRole) continue
    const step = APPROVAL_SIGNOFF_STEPS.find((entry) => entry.role === mappedRole)
    if (!step) continue
    byRole.set(mappedRole, {
      role: step.role,
      label: step.label,
      status: (item as ApprovalSignoff).status === 'approved' ? 'approved' : 'pending',
      approverName: String((item as ApprovalSignoff).approverName ?? '').trim() || undefined,
      approvedAt: String((item as ApprovalSignoff).approvedAt ?? '').trim() || undefined,
    })
  }

  return APPROVAL_SIGNOFF_STEPS.map(
    (step) =>
      byRole.get(step.role) ?? {
        role: step.role,
        label: step.label,
        status: 'pending',
      },
  )
}

export function canApproveSignoff(signoffs: ApprovalSignoff[], role: ApprovalSignoffRole) {
  if (isAutoSignoffRole(role)) return false
  const index = signoffs.findIndex((item) => item.role === role)
  if (index < 0) return false
  if (signoffs[index].status === 'approved') return false
  return signoffs.slice(0, index).every((item) => item.status === 'approved')
}

export function applyAuthorSignoff(signoffs: ApprovalSignoff[], authorName: string): ApprovalSignoff[] {
  const name = authorName.trim()
  if (!name) return signoffs

  return signoffs.map((item) =>
    item.role === 'draft'
      ? {
          ...item,
          status: 'approved' as const,
          approverName: name,
          approvedAt: new Date().toISOString(),
        }
      : item,
  )
}

export function applySignoff(
  signoffs: ApprovalSignoff[],
  role: ApprovalSignoffRole,
  approverName: string,
): ApprovalSignoff[] {
  if (!canApproveSignoff(signoffs, role)) return signoffs

  return signoffs.map((item) =>
    item.role === role
      ? {
          ...item,
          status: 'approved',
          approverName: approverName.trim(),
          approvedAt: new Date().toISOString(),
        }
      : item,
  )
}

export function getSignoffProgress(signoffs: ApprovalSignoff[]) {
  const approvedCount = signoffs.filter((item) => item.status === 'approved').length
  const total = signoffs.length
  const isComplete = approvedCount === total
  const nextPending = signoffs.find((item) => item.status === 'pending')
  return { approvedCount, total, isComplete, nextPending }
}

export function getSignoffStatusLabel(signoffs: ApprovalSignoff[]) {
  const { isComplete, nextPending, approvedCount, total } = getSignoffProgress(signoffs)
  if (isComplete) return '결재완료'
  if (approvedCount === 0) return `${nextPending?.label ?? '작성'} 대기`
  return `${nextPending?.label ?? '결재'} 대기 (${approvedCount}/${total})`
}

export function getSignoffActionLabel(role: ApprovalSignoffRole) {
  if (role === 'approval') return '승인하기'
  return '검토하기'
}

export function formatSignoffDate(iso?: string) {
  if (!iso) return ''
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
  }).format(date)
}

export function readStoredApproverName() {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem(APPROVER_NAME_STORAGE_KEY) ?? ''
}

export function storeApproverName(name: string) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(APPROVER_NAME_STORAGE_KEY, name.trim())
}
