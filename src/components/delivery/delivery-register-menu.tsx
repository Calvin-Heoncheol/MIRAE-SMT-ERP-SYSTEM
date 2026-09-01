'use client'

import { useEffect, useRef, useState } from 'react'
import { ERP_PRIMARY_BUTTON_CLASS } from '@/lib/ui/tokens'

type DeliveryRegisterMenuProps = {
  onOpenRegister: () => void
  onOpenLegacy: () => void
  disabled?: boolean
}

export function DeliveryRegisterMenu({
  onOpenRegister,
  onOpenLegacy,
  disabled = false,
}: DeliveryRegisterMenuProps) {
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

  useEffect(() => {
    if (disabled) setOpen(false)
  }, [disabled])

  function selectRegister() {
    setOpen(false)
    onOpenRegister()
  }

  function selectLegacy() {
    setOpen(false)
    onOpenLegacy()
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((value) => !value)}
        className={`${ERP_PRIMARY_BUTTON_CLASS} inline-flex items-center gap-1`}
      >
        출하 등록
        <span className="text-[10px] leading-none opacity-80" aria-hidden>
          ▾
        </span>
      </button>

      {open ? (
        <div className="absolute right-0 z-20 mt-2 min-w-[220px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={selectRegister}
            className="block w-full px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            출하 등록
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              생산 완료 품목 출하·거래명세서 발행
            </span>
          </button>
          <button
            type="button"
            onClick={selectLegacy}
            className="block w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            과거 등록
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              생산 없이 당시 명세 기준으로 등록
            </span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
