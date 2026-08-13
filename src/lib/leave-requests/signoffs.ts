import type { ApprovalSignoff, ApprovalSignoffRole } from '@/lib/approvals/signoffs'

export const LEAVE_SIGNOFF_STEPS = [
  { role: 'team_leader', label: '팀장' },
  { role: 'director', label: '이사' },
  { role: 'executive_vp', label: '전무' },
] as const satisfies ReadonlyArray<{ role: ApprovalSignoffRole; label: string }>

const LEGACY_ROLE_MAP: Record<string, ApprovalSignoffRole> = {
  team_leader: 'team_leader',
  director: 'director',
  executive_vp: 'executive_vp',
  manager: 'team_leader',
  review1: 'team_leader',
  review2: 'director',
  review3: 'executive_vp',
  executive: 'executive_vp',
}

export function createDefaultLeaveSignoffs(): ApprovalSignoff[] {
  return LEAVE_SIGNOFF_STEPS.map((step) => ({
    role: step.role,
    label: step.label,
    status: 'pending',
  }))
}

export function normalizeLeaveSignoffs(raw: unknown): ApprovalSignoff[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return createDefaultLeaveSignoffs()
  }

  const byRole = new Map<ApprovalSignoffRole, ApprovalSignoff>()
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const rawRole = String((item as ApprovalSignoff).role ?? '')
    const mappedRole = LEGACY_ROLE_MAP[rawRole]
    if (!mappedRole) continue
    const step = LEAVE_SIGNOFF_STEPS.find((entry) => entry.role === mappedRole)
    if (!step) continue
    byRole.set(mappedRole, {
      role: step.role,
      label: step.label,
      status: (item as ApprovalSignoff).status === 'approved' ? 'approved' : 'pending',
      approvedAt: String((item as ApprovalSignoff).approvedAt ?? '').trim() || undefined,
    })
  }

  return LEAVE_SIGNOFF_STEPS.map(
    (step) =>
      byRole.get(step.role) ?? {
        role: step.role,
        label: step.label,
        status: 'pending',
      },
  )
}
