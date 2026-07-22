import { createBrowserClient } from '@supabase/ssr'

/** 브라우저 전용 — 로그인 세션(쿠키) 유지 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.')
  }
  return createBrowserClient(url, anonKey)
}
