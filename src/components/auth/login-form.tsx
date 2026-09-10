'use client'

import { useActionState } from 'react'
import { loginWithPassword, type LoginActionState } from '@/lib/auth/actions'
import { ERP_FIELD_INPUT_CLASS, ERP_PRIMARY_BUTTON_CLASS } from '@/lib/ui/tokens'

const initialState: LoginActionState = { ok: false, message: null }

type LoginFormProps = {
  nextPath: string
}

export function LoginForm({ nextPath }: LoginFormProps) {
  const [state, formAction, pending] = useActionState(loginWithPassword, initialState)

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="next" value={nextPath} />

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-slate-700">이메일</span>
        <input
          name="email"
          type="email"
          autoComplete="username"
          required
          autoFocus
          placeholder="name@company.com"
          className={`${ERP_FIELD_INPUT_CLASS} h-11 rounded-xl`}
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1.5 block font-medium text-slate-700">비밀번호</span>
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          placeholder="비밀번호"
          className={`${ERP_FIELD_INPUT_CLASS} h-11 rounded-xl`}
        />
      </label>

      {state.message ? (
        <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className={`${ERP_PRIMARY_BUTTON_CLASS} flex h-11 w-full items-center justify-center rounded-xl font-bold disabled:opacity-60`}
      >
        {pending ? '로그인 중…' : '로그인'}
      </button>
    </form>
  )
}
