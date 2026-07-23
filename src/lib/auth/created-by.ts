import { createSupabaseBrowserClient } from '@/lib/supabase/browser'

export type CreatedBySnapshot = {
  createdBy: string | null
  createdByName: string
}

/**
 * 브라우저 로그인 세션 기준 등록자 스냅샷.
 * (서버/미로그인·세션 없음이면 빈 값)
 *
 * 주의: AUTH_ENABLED 는 서버 전용 env 라서 클라이언트에서 isAuthDisabled() 를
 * 쓰면 개발모드에서 항상 "인증 꺼짐"으로 오판 → 등록자가 비게 됩니다.
 */
export async function resolveCreatedBySnapshot(): Promise<CreatedBySnapshot> {
  if (typeof window === 'undefined') {
    return { createdBy: null, createdByName: '' }
  }

  try {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { createdBy: null, createdByName: '' }

    const metaName = String(
      user.user_metadata?.display_name ||
        user.user_metadata?.full_name ||
        user.user_metadata?.name ||
        '',
    ).trim()

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const createdByName =
      (profile?.display_name || '').trim() ||
      metaName ||
      (profile?.email || user.email || '').split('@')[0] ||
      ''

    return { createdBy: user.id, createdByName }
  } catch {
    return { createdBy: null, createdByName: '' }
  }
}

/** insert payload에 등록자 컬럼을 붙인다 */
export async function withCreatedByFields<T extends Record<string, unknown>>(base: T) {
  const snap = await resolveCreatedBySnapshot()
  return {
    ...base,
    created_by: snap.createdBy,
    created_by_name: snap.createdByName,
  }
}

export function isMissingCreatedByColumn(message: string) {
  return message.includes('created_by') || message.includes('created_by_name')
}

/** 컬럼 미적용 DB 호환 — created_by* 제거 후 재시도용 */
export function stripCreatedByFields<T extends Record<string, unknown>>(row: T) {
  const { created_by: _by, created_by_name: _name, ...rest } = row
  return rest
}
