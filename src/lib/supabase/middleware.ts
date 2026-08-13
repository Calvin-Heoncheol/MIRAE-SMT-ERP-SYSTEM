import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isAuthDisabled } from '@/lib/auth/config'
import { canAccessPath } from '@/lib/auth/permissions'
import { normalizeAuthDepartment, normalizeAuthRole } from '@/lib/auth/types'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !anonKey || isAuthDisabled()) {
    return supabaseResponse
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const pathname = request.nextUrl.pathname
  const isLoginPage = pathname === '/login' || pathname.startsWith('/login/')
  const isForbiddenPage = pathname === '/forbidden' || pathname.startsWith('/forbidden/')
  const isPublicAsset =
    pathname.startsWith('/_next') ||
    pathname.startsWith('/branding') ||
    pathname === '/favicon.ico'

  if (isPublicAsset) {
    return supabaseResponse
  }

  if (!user && !isLoginPage) {
    const redirectUrl = request.nextUrl.clone()
    redirectUrl.pathname = '/login'
    redirectUrl.searchParams.set('next', `${pathname}${request.nextUrl.search}`)
    return NextResponse.redirect(redirectUrl)
  }

  if (user && isLoginPage) {
    const redirectUrl = request.nextUrl.clone()
    const next = request.nextUrl.searchParams.get('next') || '/'
    if (next.startsWith('/')) {
      const [path, query = ''] = next.split('?')
      redirectUrl.pathname = path || '/'
      redirectUrl.search = query ? `?${query}` : ''
    } else {
      redirectUrl.pathname = '/'
      redirectUrl.search = ''
    }
    return NextResponse.redirect(redirectUrl)
  }

  // 메뉴는 사이드바에 보이되, 권한 없는 URL 직접 접근·클릭은 여기서 차단.
  if (user && !isLoginPage && !isForbiddenPage) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, department')
      .eq('id', user.id)
      .maybeSingle()

    const allowed = canAccessPath(
      {
        role: normalizeAuthRole(profile?.role),
        department: normalizeAuthDepartment(profile?.department),
      },
      pathname,
      request.nextUrl.searchParams,
    )

    if (!allowed) {
      const redirectUrl = request.nextUrl.clone()
      redirectUrl.pathname = '/forbidden'
      redirectUrl.search = ''
      redirectUrl.searchParams.set('from', `${pathname}${request.nextUrl.search}`)
      return NextResponse.redirect(redirectUrl)
    }
  }

  return supabaseResponse
}
