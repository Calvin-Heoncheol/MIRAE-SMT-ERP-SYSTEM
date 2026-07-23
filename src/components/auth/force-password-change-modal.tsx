'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import { changeOwnPasswordAction } from '@/lib/auth/actions'

type ForcePasswordChangeModalProps = {
  open: boolean
}

const inputClass =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-100'

export function ForcePasswordChangeModal({ open }: ForcePasswordChangeModalProps) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  if (!open) return null

  function handleSubmit() {
    setError(null)
    startTransition(async () => {
      const result = await changeOwnPasswordAction({
        password,
        confirmPassword: confirm,
      })
      if (!result.ok) {
        setError(result.message)
        return
      }
      router.refresh()
    })
  }

  return (
    <ErpModal
      open
      size="form"
      title="비밀번호 변경"
      description="초기 비밀번호로 로그인했습니다. 계속 사용하려면 새 비밀번호로 변경해 주세요."
      onClose={() => {}}
      closeOnEscape={false}
      showCloseButton={false}
      zIndexClassName="z-[100]"
      footer={
        <ErpButton type="button" disabled={pending} onClick={handleSubmit}>
          {pending ? '변경 중…' : '비밀번호 변경'}
        </ErpButton>
      }
    >
      <div className="space-y-4">
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-600">새 비밀번호</span>
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6자 이상"
            autoComplete="new-password"
            disabled={pending}
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-medium text-slate-600">새 비밀번호 확인</span>
          <input
            className={inputClass}
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="한 번 더 입력"
            autoComplete="new-password"
            disabled={pending}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit()
            }}
          />
        </label>
        {error ? (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">
            {error}
          </p>
        ) : null}
      </div>
    </ErpModal>
  )
}
