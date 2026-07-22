'use server'

import { redirect } from 'next/navigation'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  getAuthDevCredentials,
  isAuthDevAutoLoginEnabled,
  isAuthDisabled,
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
