export const APPROVAL_SIGNOFF_STEPS = [
  { role: 'team_leader', label: '팀장' },
  { role: 'director', label: '이사' },
  { role: 'executive_vp', label: '전무' },
  { role: 'president', label: '사장' },
] as const

export type ApprovalSignoffRole = (typeof APPROVAL_SIGNOFF_STEPS)[number]['role']

export type ApprovalSignoff = {
  role: ApprovalSignoffRole
  label: string
  status: 'pending' | 'approved'
  approvedAt?: string
}

const LEGACY_ROLE_MAP: Record<string, ApprovalSignoffRole> = {
  team_leader: 'team_leader',
  director: 'director',
  executive_vp: 'executive_vp',
  president: 'president',
  manager: 'team_leader',
  review1: 'team_leader',
  review2: 'director',
  review3: 'executive_vp',
  approval: 'president',
  executive: 'executive_vp',
  ceo: 'president',
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
  const index = signoffs.findIndex((item) => item.role === role)
  if (index < 0) return false
  if (signoffs[index].status === 'approved') return false
  return signoffs.slice(0, index).every((item) => item.status === 'approved')
}

export function canRevokeSignoff(signoffs: ApprovalSignoff[], role: ApprovalSignoffRole) {
  const index = signoffs.findIndex((item) => item.role === role)
  if (index < 0) return false
  if (signoffs[index].status !== 'approved') return false
  return signoffs.slice(index + 1).every((item) => item.status === 'pending')
}

export function applySignoff(signoffs: ApprovalSignoff[], role: ApprovalSignoffRole): ApprovalSignoff[] {
  if (!canApproveSignoff(signoffs, role)) return signoffs

  return signoffs.map((item) =>
    item.role === role
      ? {
          ...item,
          status: 'approved',
          approvedAt: new Date().toISOString(),
        }
      : item,
  )
}

export function revokeSignoff(signoffs: ApprovalSignoff[], role: ApprovalSignoffRole): ApprovalSignoff[] {
  if (!canRevokeSignoff(signoffs, role)) return signoffs

  return signoffs.map((item) =>
    item.role === role
      ? {
          ...item,
          status: 'pending',
          approvedAt: undefined,
        }
      : item,
  )
}

export function toggleSignoff(signoffs: ApprovalSignoff[], role: ApprovalSignoffRole): ApprovalSignoff[] {
  const index = signoffs.findIndex((item) => item.role === role)
  if (index < 0) return signoffs

  if (signoffs[index].status === 'approved') {
    return revokeSignoff(signoffs, role)
  }

  return applySignoff(signoffs, role)
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
  if (approvedCount === 0) return `${nextPending?.label ?? '팀장'} 대기`
  return `${nextPending?.label ?? '결재'} 대기 (${approvedCount}/${total})`
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

export function resolveApprovalDateFromSignoffs(signoffs: ApprovalSignoff[]): string {
  const { isComplete } = getSignoffProgress(signoffs)
  if (!isComplete) return ''

  const finalSignoff = [...signoffs].reverse().find((item) => item.status === 'approved' && item.approvedAt)
  if (!finalSignoff?.approvedAt) return ''

  const date = new Date(finalSignoff.approvedAt)
  if (Number.isNaN(date.getTime())) return ''

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = parts.find((part) => part.type === 'year')?.value ?? ''
  const month = parts.find((part) => part.type === 'month')?.value ?? ''
  const day = parts.find((part) => part.type === 'day')?.value ?? ''
  if (!year || !month || !day) return ''

  return `${year}-${month}-${day}`
}
