'use client'

import { useEffect, useRef, useState } from 'react'
import { ERP_SECONDARY_BUTTON_CLASS } from '@/lib/ui/tokens'

const ADD_COUNTS = [10, 50, 100] as const

type BomAddRowsControlProps = {
  disabled?: boolean
  onAddOne: () => void
  onAddMany: (count: number) => void
}

export function BomAddRowsControl({
  disabled = false,
  onAddOne,
  onAddMany,
}: BomAddRowsControlProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handlePointerDown(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
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

  return (
    <div ref={rootRef} className="relative inline-flex">
      <div className="inline-flex min-w-[8.75rem] overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <button
          type="button"
          disabled={disabled}
          onClick={onAddOne}
          title="행 1개 추가"
          className={`${ERP_SECONDARY_BUTTON_CLASS} min-w-0 flex-1 justify-center rounded-none border-0 border-r border-slate-200 shadow-none`}
        >
          추가
        </button>
        <button
          type="button"
          disabled={disabled}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label="여러 행 추가"
          onClick={() => setOpen((value) => !value)}
          className="inline-flex items-center justify-center px-2.5 text-slate-600 transition hover:bg-slate-50 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-[10px] leading-none" aria-hidden>
            ▾
          </span>
        </button>
      </div>
      {open ? (
        <div
          role="menu"
          className="absolute bottom-full left-0 z-20 mb-1 min-w-[7.5rem] overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-lg"
        >
          {ADD_COUNTS.map((count) => (
            <button
              key={count}
              type="button"
              role="menuitem"
              className="flex w-full px-3 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
              onClick={() => {
                onAddMany(count)
                setOpen(false)
              }}
            >
              +{count}행
            </button>
          ))}
        </div>
      ) : null}
    </div>
  )
}
