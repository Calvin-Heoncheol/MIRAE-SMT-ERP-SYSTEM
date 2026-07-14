'use client'

import { useEffect, useRef, useState } from 'react'
import type { QuoteType } from '@/lib/quotes/types'

type QuoteNewMenuProps = {
  onOpenNew: (quoteType: QuoteType) => void
}

export function QuoteNewMenu({ onOpenNew }: QuoteNewMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function selectType(quoteType: QuoteType) {
    setOpen(false)
    onOpenNew(quoteType)
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
      >
        견적서 등록
        <span className="ml-1 text-xs opacity-80">▾</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => selectType('export')}
            className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            해외용 견적서
            <span className="mt-0.5 block text-xs font-normal text-slate-500">원화 · 영문 미리보기/PDF</span>
          </button>
          <button
            type="button"
            onClick={() => selectType('domestic')}
            className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            국내용 견적서
            <span className="mt-0.5 block text-xs font-normal text-slate-500">원화 · 국문 미리보기/PDF</span>
          </button>
          <button
            type="button"
            onClick={() => selectType('legacy')}
            className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            (구) 견적서
            <span className="mt-0.5 block text-xs font-normal text-slate-500">고객사 · 제품 · 비용 간단 등록</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
