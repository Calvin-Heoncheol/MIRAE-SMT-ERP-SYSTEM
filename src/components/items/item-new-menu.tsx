'use client'

import { useEffect, useRef, useState } from 'react'

type ItemNewMenuProps = {
  onOpenCreate: () => void
  onOpenBulk: () => void
}

export function ItemNewMenu({ onOpenCreate, onOpenBulk }: ItemNewMenuProps) {
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

  function select(action: () => void) {
    setOpen(false)
    action()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
      >
        품목 등록
        <span className="ml-1 text-xs opacity-80">▾</span>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => select(onOpenCreate)}
            className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            개별 등록
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              한 건씩 직접 입력
            </span>
          </button>
          <button
            type="button"
            onClick={() => select(onOpenBulk)}
            className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            일괄 등록
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              Excel에서 복사해 붙여넣기
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
