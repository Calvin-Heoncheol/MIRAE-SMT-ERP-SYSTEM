'use client'

import { useEffect, useRef, useState } from 'react'
import type { QuoteType } from '@/lib/quotes/types'

type QuoteNewMenuProps = {
  onOpenNew: (quoteType: QuoteType) => void
  onOpenLegacy?: () => void
  onOpenAi?: () => void
}

export function QuoteNewMenu({ onOpenNew, onOpenLegacy, onOpenAi }: QuoteNewMenuProps) {
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

  function selectLegacy() {
    setOpen(false)
    onOpenLegacy?.()
  }

  function selectAi() {
    setOpen(false)
    onOpenAi?.()
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
        <div className="absolute right-0 z-20 mt-2 min-w-[240px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={selectAi}
            className="block w-full bg-violet-50 px-4 py-3 text-left text-sm font-semibold text-violet-900 hover:bg-violet-100/80"
          >
            AI 견적
            <span className="mt-0.5 block text-xs font-normal text-violet-700/90">
              좌표·BOM 자동 분석 후 견적서 작성
            </span>
          </button>
          <button
            type="button"
            onClick={() => selectType('export')}
            className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
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
            onClick={selectLegacy}
            className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            과거 견적서
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              SMD·후공정·자재 대당 비용만 입력
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
