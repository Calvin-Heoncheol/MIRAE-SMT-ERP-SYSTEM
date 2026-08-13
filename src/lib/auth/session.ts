import { createSupabaseServerClient } from '@/lib/supabase/server'
import { isAuthDisabled } from '@/lib/auth/config'
import {
  normalizeAuthDepartment,
  normalizeAuthRole,
  type AuthProfile,
} from '@/lib/auth/types'

export async function getAuthUser() {
  if (isAuthDisabled()) return null
  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  return user
}

export async function getAuthProfile(): Promise<AuthProfile | null> {
  if (isAuthDisabled()) {
    return {
      id: 'dev',
      email: 'dev@local',
      displayName: '개발모드',
      role: 'admin',
      department: null,
      mustChangePassword: false,
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('id, email, display_name, role, department, must_change_password')
    .eq('id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[auth] profiles 조회 실패:', error.message)
  }

  if (!profile) {
    return {
      id: user.id,
      email: user.email || '',
      displayName: user.email?.split('@')[0] || '사용자',
      role: 'operator',
      department: null,
      mustChangePassword: false,
    }
  }

  const displayName =
    (profile.display_name || '').trim() ||
    (profile.email || user.email || '').split('@')[0] ||
    '사용자'

  return {
    id: profile.id,
    email: profile.email || user.email || '',
    displayName,
    role: normalizeAuthRole(profile.role),
    department: normalizeAuthDepartment(profile.department),
    mustChangePassword: Boolean(profile.must_change_password),
  }
}
