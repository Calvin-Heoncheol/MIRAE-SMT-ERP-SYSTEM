'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { ERP_PDF_BUTTON_CLASS } from '@/lib/ui/tokens'

export type PdfDownloadMenuItem = {
  label: string
  onDownload: () => void
}

type PdfDownloadButtonProps = {
  onDownload: () => void
  disabled?: boolean
  /** 기본 PDF. 견적 영문 등 라벨 변경용 */
  label?: string
  /**
   * 있으면 PDF 버튼 클릭 시 드롭다운으로 선택.
   * 없으면 바로 onDownload 실행.
   */
  menuItems?: PdfDownloadMenuItem[]
}

/** 전 페이지 공통 PDF 내보내기 — 로즈 */
export function PdfDownloadButton({
  onDownload,
  disabled = false,
  label = 'PDF',
  menuItems,
}: PdfDownloadButtonProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const hasMenu = Boolean(menuItems && menuItems.length > 0)

  useEffect(() => {
    if (!open) return

    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('mousedown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  if (!hasMenu) {
    return (
      <button
        type="button"
        onClick={onDownload}
        disabled={disabled}
        className={ERP_PDF_BUTTON_CLASS}
      >
        {label}
      </button>
    )
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        disabled={disabled}
        className={`${ERP_PDF_BUTTON_CLASS} inline-flex items-center gap-1`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
      >
        {label}
        <span className="text-[10px] leading-none opacity-90" aria-hidden>
          ▾
        </span>
      </button>
      {open ? (
        <div
          id={menuId}
          role="menu"
          className="absolute right-0 z-50 mt-1 min-w-[7.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {menuItems!.map((item) => (
            <button
              key={item.label}
              type="button"
              role="menuitem"
              className="block w-full px-3 py-2 text-left text-xs font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-700"
              onClick={() => {
                setOpen(false)
                item.onDownload()
              }}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
