import { createBrowserClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const globalForSupabase = globalThis as typeof globalThis & {
  __miraeSupabaseBrowser?: SupabaseClient
  __miraeSupabaseServer?: SupabaseClient
}

function requireEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.')
  }

  return { url, anonKey }
}

/**
 * 데이터 조회·쓰기용 클라이언트.
 * - 브라우저: 로그인 세션(JWT) 포함 → RLS `authenticated` 정책과 맞춤
 * - 서버(RSC): anon (세션 없음) → SELECT 정책이 anon 허용이어야 함
 *
 * 서버에서 로그인 사용자로 쓰려면 `@/lib/supabase/server` 의 createSupabaseServerClient 사용.
 */
export function createSupabaseClient() {
  const { url, anonKey } = requireEnv()
  const isBrowser = typeof window !== 'undefined'

  if (isBrowser) {
    if (!globalForSupabase.__miraeSupabaseBrowser) {
      globalForSupabase.__miraeSupabaseBrowser = createBrowserClient(url, anonKey)
    }
    return globalForSupabase.__miraeSupabaseBrowser
  }

  if (!globalForSupabase.__miraeSupabaseServer) {
    globalForSupabase.__miraeSupabaseServer = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    })
  }
  return globalForSupabase.__miraeSupabaseServer
}
