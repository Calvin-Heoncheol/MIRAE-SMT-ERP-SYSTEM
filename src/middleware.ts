import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  return updateSession(request)
}

export const config = {
  matcher: [
    /*
     * 정적 파일·이미지·설비 로그 수신 API 제외.
     * /api/solder-paste/logs 는 하루치 TXT가 커서 미들웨어를 타면 빈 500이 날 수 있다.
     */
    '/((?!_next/static|_next/image|favicon.ico|branding/.*|api/solder-paste/logs|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
