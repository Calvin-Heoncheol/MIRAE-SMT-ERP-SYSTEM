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

  // OPEN(인증 끔) 모드는 로컬 업무 입력만 — 삭제·직접재고·기초등록 불가
  if (resolved === 'open') {
    if (input.module === 'master') {
      return {
        ok: false,
        reason: 'auth',
        detail: '개발(OPEN) 모드에서는 기초등록을 변경할 수 없습니다. AUTH_ENABLED=true 로 로그인하세요.',
      }
    }
    if (input.action === 'delete' || input.action === 'adjust') {
      return {
        ok: false,
        reason: 'auth',
        detail:
          input.action === 'adjust'
            ? '개발(OPEN) 모드에서는 직접재고 조정을 할 수 없습니다.'
            : '개발(OPEN) 모드에서는 삭제를 할 수 없습니다. AUTH_ENABLED=true 로 로그인하세요.',
      }
    }
  }

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
