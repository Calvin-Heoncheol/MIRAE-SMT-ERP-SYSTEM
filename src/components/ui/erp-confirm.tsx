'use client'

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'

export type ErpConfirmTone = 'danger' | 'default'

export type ErpConfirmOptions = {
  title: string
  /** 여러 줄은 \\n 로 구분 */
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: ErpConfirmTone
}

type PendingConfirm = ErpConfirmOptions & {
  resolve: (value: boolean) => void
}

type ErpConfirmFn = (options: ErpConfirmOptions) => Promise<boolean>

const ErpConfirmContext = createContext<ErpConfirmFn | null>(null)

export function useErpConfirm(): ErpConfirmFn {
  const confirm = useContext(ErpConfirmContext)
  if (!confirm) {
    return async (options) =>
      typeof window !== 'undefined'
        ? window.confirm([options.title, options.message].filter(Boolean).join('\n\n'))
        : false
  }
  return confirm
}

export function ErpConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null)
  const pendingRef = useRef<PendingConfirm | null>(null)

  const finish = useCallback((value: boolean) => {
    const current = pendingRef.current
    pendingRef.current = null
    setPending(null)
    current?.resolve(value)
  }, [])

  const confirm = useCallback<ErpConfirmFn>((options) => {
    return new Promise<boolean>((resolve) => {
      if (pendingRef.current) {
        pendingRef.current.resolve(false)
      }
      const next: PendingConfirm = { ...options, resolve }
      pendingRef.current = next
      setPending(next)
    })
  }, [])

  const value = useMemo(() => confirm, [confirm])
  const tone = pending?.tone ?? 'default'
  const lines = (pending?.message || '').split('\n')

  return (
    <ErpConfirmContext.Provider value={value}>
      {children}
      {pending ? (
        <ErpModal
          open
          size="form"
          title={pending.title}
          onClose={() => finish(false)}
          closeOnEscape
          zIndexClassName="z-[70]"
          contentClassName="min-h-0 flex-1 overflow-y-auto px-5 py-4"
          footer={
            <>
              <ErpButton variant="secondary" onClick={() => finish(false)}>
                {pending.cancelLabel || '취소'}
              </ErpButton>
              <ErpButton
                variant={tone === 'danger' ? 'danger' : 'primary'}
                onClick={() => finish(true)}
                autoFocus
              >
                {pending.confirmLabel || (tone === 'danger' ? '삭제' : '확인')}
              </ErpButton>
            </>
          }
        >
          <div className="space-y-1 text-sm leading-relaxed text-slate-700">
            {lines.map((line, index) =>
              line ? (
                <p key={index}>{line}</p>
              ) : (
                <div key={index} className="h-2" aria-hidden />
              ),
            )}
          </div>
        </ErpModal>
      ) : null}
    </ErpConfirmContext.Provider>
  )
}
