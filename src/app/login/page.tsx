import Image from 'next/image'
import { LoginForm } from '@/components/auth/login-form'
import { tryDevAutoLogin } from '@/lib/auth/actions'
import { isAuthDevAutoLoginEnabled, isAuthDisabled } from '@/lib/auth/config'
import { APP_NAME, APP_SHORT_NAME } from '@/lib/app-config'
import { redirect } from 'next/navigation'

type LoginPageProps = {
  searchParams?: Promise<{ next?: string | string[] }>
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (isAuthDisabled()) {
    redirect('/')
  }

  const params = searchParams ? await searchParams : {}
  const rawNext = params.next
  const nextPath = Array.isArray(rawNext) ? rawNext[0] || '/' : rawNext || '/'

  let autoLoginError: string | null = null
  if (isAuthDevAutoLoginEnabled()) {
    const result = await tryDevAutoLogin(nextPath)
    if (result.attempted && !result.ok) {
      autoLoginError = result.message
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gradient-to-br from-slate-100 via-white to-sky-50 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="relative h-10 w-[5.25rem] shrink-0">
            <Image
              src="/branding/logo.png"
              alt=""
              fill
              priority
              sizes="84px"
              className="object-contain object-left"
            />
          </span>
          <div>
            <p className="text-lg font-bold text-slate-900">{APP_SHORT_NAME}</p>
            <p className="text-sm text-slate-500">{APP_NAME} 로그인</p>
          </div>
        </div>

        <p className="mb-5 text-sm text-slate-600">
          등록된 직원 계정으로 로그인해 주세요. 계정은 관리자가 발급합니다.
        </p>

        {autoLoginError ? (
          <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {autoLoginError}
          </p>
        ) : null}

        <LoginForm nextPath={nextPath.startsWith('/') ? nextPath : '/'} />
      </div>
    </div>
  )
}
