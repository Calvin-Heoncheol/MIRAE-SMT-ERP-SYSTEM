'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getAuthDevCredentials,
  isAuthDevAutoLoginEnabled,
  isAuthDisabled,
  DEFAULT_INITIAL_PASSWORD,
} from '@/lib/auth/config'

export type LoginActionState = {
  ok: boolean
  message: string | null
}

export async function loginWithPassword(
  _prev: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  if (isAuthDisabled()) {
    redirect('/')
  }

  const email = String(formData.get('email') || '').trim()
  const password = String(formData.get('password') || '')
  const next = String(formData.get('next') || '/').trim() || '/'

  if (!email || !password) {
    return { ok: false, message: '이메일과 비밀번호를 입력해 주세요.' }
  }

  const supabase = await createSupabaseServerClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      ok: false,
      message: error.message.includes('Invalid login')
        ? '이메일 또는 비밀번호가 올바르지 않습니다.'
        : error.message,
    }
  }

  redirect(next.startsWith('/') ? next : '/')
}

export async function tryDevAutoLogin(nextPath = '/') {
  if (!isAuthDevAutoLoginEnabled()) return { attempted: false as const }
  const credentials = getAuthDevCredentials()
  if (!credentials) return { attempted: false as const }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (user) {
    redirect(nextPath.startsWith('/') ? nextPath : '/')
  }

  const { error } = await supabase.auth.signInWithPassword(credentials)
  if (error) {
    return {
      attempted: true as const,
      ok: false as const,
      message: `개발 자동 로그인 실패: ${error.message}`,
    }
  }

  redirect(nextPath.startsWith('/') ? nextPath : '/')
}

export async function logoutAction() {
  if (!isAuthDisabled()) {
    const supabase = await createSupabaseServerClient()
    await supabase.auth.signOut()
  }
  redirect('/login')
}

export type ChangePasswordResult =
  | { ok: true }
  | { ok: false; message: string }

/** 로그인 사용자 본인 비밀번호 변경 + must_change_password 해제 */
export async function changeOwnPasswordAction(input: {
  password: string
  confirmPassword: string
}): Promise<ChangePasswordResult> {
  if (isAuthDisabled()) {
    return { ok: false, message: '개발 모드에서는 비밀번호를 변경할 수 없습니다.' }
  }

  const password = String(input.password || '')
  const confirmPassword = String(input.confirmPassword || '')

  if (password.length < 6) {
    return { ok: false, message: '비밀번호는 6자 이상이어야 합니다.' }
  }
  if (password !== confirmPassword) {
    return { ok: false, message: '새 비밀번호가 일치하지 않습니다.' }
  }
  if (password === DEFAULT_INITIAL_PASSWORD) {
    return { ok: false, message: '초기 비밀번호와 다른 비밀번호를 입력해 주세요.' }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, message: '로그인이 필요합니다.' }
  }

  const { error } = await supabase.auth.updateUser({ password })
  if (error) {
    return { ok: false, message: error.message }
  }

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      must_change_password: false,
      updated_at: new Date().toISOString(),
    })
    .eq('id', user.id)

  if (profileError) {
    return {
      ok: false,
      message: `비밀번호는 변경됐지만 상태 저장 실패: ${profileError.message}`,
    }
  }

  return { ok: true }
}
