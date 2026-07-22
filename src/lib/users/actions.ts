'use server'

import { getAuthProfile } from '@/lib/auth/session'
import { isAuthDisabled } from '@/lib/auth/config'
import {
  AUTH_DEPARTMENTS,
  AUTH_ROLES,
  normalizeAuthDepartment,
  normalizeAuthRole,
  type AuthDepartment,
  type AuthRole,
} from '@/lib/auth/types'
import { createSupabaseAdminClient, hasSupabaseServiceRoleKey } from '@/lib/supabase/admin'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import type { CreateErpUserInput, ErpUserRow, UpdateErpUserInput } from './types'

export type FetchErpUsersResult =
  | { ok: true; users: ErpUserRow[] }
  | { ok: false; reason: 'env' | 'auth' | 'query'; detail: string }

export type MutateErpUserResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'auth' | 'validation' | 'query'; detail: string }

async function requireAdmin(): Promise<
  { ok: true } | { ok: false; reason: 'auth'; detail: string }
> {
  if (isAuthDisabled()) return { ok: true }
  const profile = await getAuthProfile()
  if (!profile) return { ok: false, reason: 'auth', detail: '로그인이 필요합니다.' }
  if (profile.role !== 'admin') {
    return { ok: false, reason: 'auth', detail: '관리자만 사용자 등록을 할 수 있습니다.' }
  }
  return { ok: true }
}

function mapProfileRow(row: {
  id: string
  email: string | null
  display_name: string | null
  role: string | null
  department: string | null
  created_at: string | null
}): ErpUserRow {
  return {
    id: row.id,
    email: row.email || '',
    displayName: (row.display_name || '').trim() || (row.email || '').split('@')[0] || '',
    role: normalizeAuthRole(row.role),
    department: normalizeAuthDepartment(row.department),
    createdAt: row.created_at || '',
  }
}

function validateRole(role: string): role is AuthRole {
  return (AUTH_ROLES as readonly string[]).includes(role)
}

function validateDepartment(value: string | null): AuthDepartment | null | false {
  if (value == null || value === '') return null
  if ((AUTH_DEPARTMENTS as readonly string[]).includes(value)) {
    return value as AuthDepartment
  }
  return false
}

export async function fetchErpUsers(): Promise<FetchErpUsersResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return gate

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
    }
  }

  try {
    // 목록 조회는 service role이 있으면 우선 사용 (RLS·개발모드 이슈 방지)
    if (hasSupabaseServiceRoleKey()) {
      const admin = createSupabaseAdminClient()
      const { data, error } = await admin
        .from('profiles')
        .select('id, email, display_name, role, department, created_at')
        .order('display_name', { ascending: true })
      if (error) return { ok: false, reason: 'query', detail: error.message }
      return { ok: true, users: (data || []).map(mapProfileRow) }
    }

    if (isAuthDisabled()) {
      return {
        ok: false,
        reason: 'env',
        detail:
          'SUPABASE_SERVICE_ROLE_KEY 가 없습니다. .env.local 에 service_role 키를 추가한 뒤 개발 서버를 재시작하세요.',
      }
    }

    const supabase = await createSupabaseServerClient()
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, display_name, role, department, created_at')
      .order('display_name', { ascending: true })

    if (error) return { ok: false, reason: 'query', detail: error.message }
    return { ok: true, users: (data || []).map(mapProfileRow) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createErpUser(input: CreateErpUserInput): Promise<MutateErpUserResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return gate

  if (!hasSupabaseServiceRoleKey()) {
    return {
      ok: false,
      reason: 'env',
      detail:
        'SUPABASE_SERVICE_ROLE_KEY 가 없습니다. .env.local 에 service_role 키를 추가한 뒤 개발 서버를 재시작하세요.',
    }
  }

  const email = String(input.email || '').trim().toLowerCase()
  const password = String(input.password || '')
  const displayName = String(input.displayName || '').trim()
  const role = input.role
  const department = input.department

  if (!email || !email.includes('@')) {
    return { ok: false, reason: 'validation', detail: '이메일을 올바르게 입력해 주세요.' }
  }
  if (password.length < 6) {
    return { ok: false, reason: 'validation', detail: '비밀번호는 6자 이상이어야 합니다.' }
  }
  if (!displayName) {
    return { ok: false, reason: 'validation', detail: '이름을 입력해 주세요.' }
  }
  if (!validateRole(role)) {
    return { ok: false, reason: 'validation', detail: '역할이 올바르지 않습니다.' }
  }
  if (validateDepartment(department) === false) {
    return { ok: false, reason: 'validation', detail: '부서가 올바르지 않습니다.' }
  }

  try {
    const admin = createSupabaseAdminClient()
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        display_name: displayName,
        role,
        department: department || '',
      },
    })

    if (error || !data.user) {
      const message = error?.message || '사용자 생성에 실패했습니다.'
      if (message.toLowerCase().includes('already')) {
        return { ok: false, reason: 'validation', detail: '이미 등록된 이메일입니다.' }
      }
      return { ok: false, reason: 'query', detail: message }
    }

    const { error: profileError } = await admin.from('profiles').upsert(
      {
        id: data.user.id,
        email,
        display_name: displayName,
        role,
        department,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      return {
        ok: false,
        reason: 'query',
        detail: `계정은 생성됐지만 프로필 저장 실패: ${profileError.message}`,
      }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function updateErpUser(input: UpdateErpUserInput): Promise<MutateErpUserResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return gate

  if (!hasSupabaseServiceRoleKey()) {
    return {
      ok: false,
      reason: 'env',
      detail:
        'SUPABASE_SERVICE_ROLE_KEY 가 없습니다. .env.local 에 service_role 키를 추가한 뒤 개발 서버를 재시작하세요.',
    }
  }

  const id = String(input.id || '').trim()
  const displayName = String(input.displayName || '').trim()
  const role = input.role
  const department = input.department
  const password = String(input.password || '')

  if (!id) {
    return { ok: false, reason: 'validation', detail: '사용자를 찾을 수 없습니다.' }
  }
  if (!displayName) {
    return { ok: false, reason: 'validation', detail: '이름을 입력해 주세요.' }
  }
  if (!validateRole(role)) {
    return { ok: false, reason: 'validation', detail: '역할이 올바르지 않습니다.' }
  }
  if (validateDepartment(department) === false) {
    return { ok: false, reason: 'validation', detail: '부서가 올바르지 않습니다.' }
  }
  if (password && password.length < 6) {
    return { ok: false, reason: 'validation', detail: '비밀번호는 6자 이상이어야 합니다.' }
  }

  try {
    const admin = createSupabaseAdminClient()

    const authUpdate: {
      user_metadata: Record<string, string>
      password?: string
    } = {
      user_metadata: {
        display_name: displayName,
        role,
        department: department || '',
      },
    }
    if (password) authUpdate.password = password

    const { error: authError } = await admin.auth.admin.updateUserById(id, authUpdate)
    if (authError) {
      return { ok: false, reason: 'query', detail: authError.message }
    }

    const { error: profileError } = await admin
      .from('profiles')
      .update({
        display_name: displayName,
        role,
        department,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)

    if (profileError) {
      return { ok: false, reason: 'query', detail: profileError.message }
    }

    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function deleteErpUser(userId: string): Promise<MutateErpUserResult> {
  const gate = await requireAdmin()
  if (!gate.ok) return gate

  if (!hasSupabaseServiceRoleKey()) {
    return {
      ok: false,
      reason: 'env',
      detail:
        'SUPABASE_SERVICE_ROLE_KEY 가 없습니다. .env.local 에 service_role 키를 추가한 뒤 개발 서버를 재시작하세요.',
    }
  }

  const id = String(userId || '').trim()
  if (!id) {
    return { ok: false, reason: 'validation', detail: '사용자를 찾을 수 없습니다.' }
  }

  if (!isAuthDisabled()) {
    const me = await getAuthProfile()
    if (me?.id === id) {
      return { ok: false, reason: 'validation', detail: '본인 계정은 삭제할 수 없습니다.' }
    }
  }

  try {
    const admin = createSupabaseAdminClient()
    const { error } = await admin.auth.admin.deleteUser(id)
    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
