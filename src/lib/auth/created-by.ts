import { createSupabaseBrowserClient } from '@/lib/supabase/browser'
import { isAuthDisabled } from '@/lib/auth/config'

export type CreatedBySnapshot = {
  createdBy: string | null
  createdByName: string
}

/** 브라우저 로그인 세션 기준 등록자 스냅샷 (서버/미로그인 시 빈 값) */
export async function resolveCreatedBySnapshot(): Promise<CreatedBySnapshot> {
  if (typeof window === 'undefined' || isAuthDisabled()) {
    return { createdBy: null, createdByName: '' }
  }

  try {
    const supabase = createSupabaseBrowserClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { createdBy: null, createdByName: '' }

    const { data: profile } = await supabase
      .from('profiles')
      .select('display_name, email')
      .eq('id', user.id)
      .maybeSingle()

    const createdByName =
      (profile?.display_name || '').trim() ||
      (profile?.email || user.email || '').split('@')[0] ||
      ''

    return { createdBy: user.id, createdByName }
  } catch {
    return { createdBy: null, createdByName: '' }
  }
}
