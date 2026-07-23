import type { AuthRole } from '@/lib/auth/types'
import type { AuthProfile } from '@/lib/auth/types'

/** 삭제·직접재고 등 위험 작업 — 팀장(manager) 이상 */
export function canPerformDangerousWrite(role: AuthRole) {
  return role === 'admin' || role === 'manager'
}

/** UI용 — 삭제 버튼 표시 여부 (서버 모듈 의존 없음) */
export function canDeleteRecords(
  profile: Pick<AuthProfile, 'role'> | null | undefined,
  authDisabled = false,
) {
  if (authDisabled) return true
  if (!profile) return false
  return canPerformDangerousWrite(profile.role)
}
