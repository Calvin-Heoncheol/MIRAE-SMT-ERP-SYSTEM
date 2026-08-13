import { createClient, type SupabaseClient } from '@supabase/supabase-js'

/**
 * Auth Admin API용 — 서버에서만 사용.
 * `.env.local`에 `SUPABASE_SERVICE_ROLE_KEY` 필요 (Dashboard → Settings → API).
 */
export function createSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY 가 없습니다. Dashboard → Project Settings → API → service_role 키를 .env.local 에 추가하세요.',
    )
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}

export function hasSupabaseServiceRoleKey() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.trim())
}
