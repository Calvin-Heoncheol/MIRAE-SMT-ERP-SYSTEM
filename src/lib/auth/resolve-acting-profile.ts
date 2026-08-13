import { isAuthDisabled } from '@/lib/auth/config'
import {
  normalizeAuthDepartment,
  normalizeAuthRole,
  type AuthProfile,
} from '@/lib/auth/types'

export const OPEN_MODE_PROFILE: AuthProfile = {
  id: 'dev',
  email: 'dev@local',
  displayName: '개발모드',
  role: 'admin',
  department: null,
  mustChangePassword: false,
}

export type ActingProfileResolution = AuthProfile | 'open' | 'unauthenticated'

/**
 * 쓰기 가드용 현재 사용자 (브라우저 전용 세션 해석).
 *
 * next/headers(session.ts) 를 절대 import 하지 않음 —
 * 이 모듈은 클라이언트 컴포넌트(모달·워크스페이스)에서 쓰이므로
 * 서버 세션 클라이언트를 끌어오면 빌드가 깨집니다.
 *
 * - AUTH 꺼짐 → open
 * - 서버/SSR 경로에서 호출 → unauthenticated (실제 쓰기는 브라우저 이벤트에서만)
 * - 브라우저 + 로그인 → 프로필
 */
export async function resolveActingProfile(): Promise<ActingProfileResolution> {
  if (isAuthDisabled()) return 'open'

  if (typeof window === 'undefined') {
    return 'unauthenticated'
  }

  try {
    const { createBrowserClient } = await import('@supabase/ssr')
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    if (!url || !anonKey) return 'unauthenticated'

    const supabase = createBrowserClient(url, anonKey)
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return 'unauthenticated'

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
    return 'unauthenticated'
  }
}
