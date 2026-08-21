import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 정적 파일·이미지 제외, 나머지 요청에 세션 갱신/로그인 가드 적용
     */
    '/((?!_next/static|_next/image|favicon.ico|branding/.*|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
