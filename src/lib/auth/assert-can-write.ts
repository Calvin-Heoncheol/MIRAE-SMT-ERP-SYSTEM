import { getAllowedModules, type AuthAccessModule } from '@/lib/auth/permissions'
import {
  OPEN_MODE_PROFILE,
  resolveActingProfile,
} from '@/lib/auth/resolve-acting-profile'
import { canPerformDangerousWrite } from '@/lib/auth/write-permissions'
import type { AuthProfile } from '@/lib/auth/types'

export type WriteAction = 'create' | 'update' | 'delete' | 'adjust'

export type WriteGuardResult =
  | { ok: true; profile: AuthProfile }
  | { ok: false; reason: 'auth'; detail: string }

/** @deprecated write-permissions 사용 — 하위 호환 re-export */
export { canDeleteRecords, canPerformDangerousWrite } from '@/lib/auth/write-permissions'

export async function assertCanWrite(input: {
  module: AuthAccessModule
  action: WriteAction
}): Promise<WriteGuardResult> {
  const resolved = await resolveActingProfile()

  if (resolved === 'unauthenticated') {
    return { ok: false, reason: 'auth', detail: '로그인이 필요합니다.' }
  }

  const profile = resolved === 'open' ? OPEN_MODE_PROFILE : resolved

  const allowed = getAllowedModules(profile)
  if (!allowed.includes(input.module)) {
    return { ok: false, reason: 'auth', detail: '이 기능에 대한 권한이 없습니다.' }
  }

  if (input.module === 'master' && profile.role !== 'admin') {
    return {
      ok: false,
      reason: 'auth',
      detail: '관리자만 기초등록을 변경할 수 있습니다.',
    }
  }

  if (
    (input.action === 'delete' || input.action === 'adjust') &&
    !canPerformDangerousWrite(profile.role)
  ) {
    return {
      ok: false,
      reason: 'auth',
      detail:
        input.action === 'adjust'
          ? '직접재고 조정은 팀장 이상만 할 수 있습니다.'
          : '삭제는 팀장 이상만 할 수 있습니다.',
    }
  }

  return { ok: true, profile }
}

export function postProcessTeamToAccessModule(
  team: string | null | undefined,
): AuthAccessModule {
  const t = String(team || '').trim()
  if (t === '생산3팀') return 'production_post_3'
  if (t === '생산4팀') return 'production_post_4'
  return 'production_post_2'
}
