import { getAllowedModules, type AuthAccessModule } from '@/lib/auth/permissions'
import { canPerformDangerousWrite } from '@/lib/auth/write-permissions'
import {
  normalizeAuthDepartment,
  normalizeAuthRole,
  type AuthProfile,
} from '@/lib/auth/types'

export type WriteAction = 'create' | 'update' | 'delete' | 'adjust'

export type WriteGuardResult =
  | { ok: true; profile: AuthProfile }
  | { ok: false; reason: 'auth'; detail: string }

/** @deprecated write-permissions 사용 — 하위 호환 re-export */
export { canDeleteRecords, canPerformDangerousWrite } from '@/lib/auth/write-permissions'

const OPEN_MODE_PROFILE: AuthProfile = {
  id: 'dev',
  email: 'dev@local',
  displayName: '개발모드',
  role: 'admin',
  department: null,
  mustChangePassword: false,
}

/**
 * next/headers·session 을 절대 import 하지 않음.
 * 브라우저에서만 @supabase/ssr browser client 를 동적 로딩.
 */
async function resolveActingProfile(): Promise<AuthProfile | 'open'> {
  if (typeof window === 'undefined') return 'open'

  try {
    const { createBrowserClient } = await import('@supabase/ssr')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return 'open'

    const supabase = createBrowserClient(url, anonKey)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 'open'

    const { data: row } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, department, must_change_password')
      .eq('id', user.id)
      .maybeSingle()

    if (!row) {
      return {
        id: user.id,
        email: user.email || '',
        displayName: user.email?.split('@')[0] || '사용자',
        role: 'operator',
        department: null,
        mustChangePassword: false,
      }
    }

    return {
      id: row.id,
      email: row.email || user.email || '',
      displayName:
        (row.display_name || '').trim() ||
        (row.email || user.email || '').split('@')[0] ||
        '사용자',
      role: normalizeAuthRole(row.role),
      department: normalizeAuthDepartment(row.department),
      mustChangePassword: Boolean(row.must_change_password),
    }
  } catch {
    return 'open'
  }
}

export async function assertCanWrite(input: {
  module: AuthAccessModule
  action: WriteAction
}): Promise<WriteGuardResult> {
  const resolved = await resolveActingProfile()
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
