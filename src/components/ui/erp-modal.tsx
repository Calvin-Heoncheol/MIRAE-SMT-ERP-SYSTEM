'use client'

import { useEffect, type ReactNode } from 'react'

type ErpModalProps = {
  open: boolean
  title: string
  description?: string
  /** form | md(불출·BOM) | xl(주문) | lg(입고) | wide(견적) */
  size?: 'form' | 'md' | 'xl' | 'lg' | 'wide'
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
  /** Esc로 닫기 (저장 중이면 false 권장) */
  closeOnEscape?: boolean
  /** 헤더 × 닫기 버튼 (강제 모달 등에서는 false) */
  showCloseButton?: boolean
  /** 본문 래퍼 클래스 (기본: px-5 py-4) */
  contentClassName?: string
  /** 헤더 우측 추가 액션 (PDF 등) — 닫기 버튼 왼쪽 */
  headerActions?: ReactNode
  zIndexClassName?: string
}

const SIZE_CLASS = {
  form: 'max-w-lg',
  md: 'max-w-3xl',
  xl: 'max-w-4xl',
  lg: 'max-w-6xl',
  wide: 'max-w-[min(1680px,98vw)]',
} as const

export function ErpModal({
  open,
  title,
  description,
  size = 'form',
  onClose,
  children,
  footer,
  closeOnEscape = true,
  showCloseButton = true,
  contentClassName = 'min-h-0 flex-1 overflow-y-auto px-5 py-4',
  headerActions,
  zIndexClassName = 'z-50',
}: ErpModalProps) {
  useEffect(() => {
    if (!open || !closeOnEscape) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, closeOnEscape, onClose])

  if (!open) return null

  return (
    <div className={`fixed inset-0 ${zIndexClassName} flex items-center justify-center bg-slate-900/45 p-3 sm:p-4`}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="erp-modal-title"
        className={`flex max-h-[94dvh] w-full ${SIZE_CLASS[size]} flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="erp-modal-title" className="text-lg font-bold text-slate-900">
              {title}
            </h2>
            {description ? <p className="mt-0.5 text-xs text-slate-500">{description}</p> : null}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {headerActions}
            {showCloseButton ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                aria-label="닫기"
              >
                ×
              </button>
            ) : null}
          </div>
        </div>

        <div className={contentClassName}>{children}</div>

        {footer ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50/80 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
