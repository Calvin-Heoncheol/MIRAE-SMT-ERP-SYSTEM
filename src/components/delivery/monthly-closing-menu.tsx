'use client'

import { useEffect, useRef, useState } from 'react'
import { ERP_EXCEL_BUTTON_CLASS } from '@/lib/ui/tokens'

export type MonthlyClosingFormat = 'excel' | 'pdf'

type MonthlyClosingMenuProps = {
  onExport: (format: MonthlyClosingFormat) => Promise<void>
  disabled?: boolean
}

const OPTIONS: Array<{ format: MonthlyClosingFormat; label: string }> = [
  { format: 'excel', label: 'EXCEL' },
  { format: 'pdf', label: 'PDF' },
]

export function MonthlyClosingMenu({ onExport, disabled = false }: MonthlyClosingMenuProps) {
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])

  async function handleSelect(format: MonthlyClosingFormat) {
    setOpen(false)
    setBusy(true)
    try {
      await onExport(format)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        disabled={disabled || busy}
        aria-haspopup="menu"
        aria-expanded={open}
        className={ERP_EXCEL_BUTTON_CLASS}
      >
        {busy ? '내보내는 중…' : '월 마감 ▾'}
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-1 min-w-[7rem] overflow-hidden rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {OPTIONS.map((option) => (
            <button
              key={option.format}
              type="button"
              role="menuitem"
              onClick={() => void handleSelect(option.format)}
              className="block w-full px-3 py-1.5 text-left text-sm font-semibold text-slate-700 hover:bg-slate-100"
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
