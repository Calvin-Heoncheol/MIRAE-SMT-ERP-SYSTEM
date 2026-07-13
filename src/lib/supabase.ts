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
 * 브라우저/서버 각각 싱글톤.
 * (anon key + 세션 미사용 — 요청 간 공유해도 사용자 자격 증명 누수 없음)
 * 브라우저에서 매번 createClient 하면 GoTrue 중복 인스턴스 경고가 납니다.
 */
export function createSupabaseClient() {
  const { url, anonKey } = requireEnv()
  const isBrowser = typeof window !== 'undefined'

  if (isBrowser) {
    if (!globalForSupabase.__miraeSupabaseBrowser) {
      globalForSupabase.__miraeSupabaseBrowser = createClient(url, anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      })
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
