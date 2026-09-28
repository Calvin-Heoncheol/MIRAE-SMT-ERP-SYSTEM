'use client'

import { useEffect, useRef, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'

type StatementPrintMenuProps = {
  onPrint: (includeVat: boolean) => void
  disabled?: boolean
  loading?: boolean
  label?: string
}

export function StatementPrintMenu({
  onPrint,
  disabled = false,
  loading = false,
  label = '거래명세서',
}: StatementPrintMenuProps) {
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

  function select(includeVat: boolean) {
    setOpen(false)
    onPrint(includeVat)
  }

  return (
    <div ref={rootRef} className="relative">
      <ErpButton
        variant="secondary"
        disabled={disabled}
        loading={loading}
        onClick={() => setOpen((value) => !value)}
      >
        {label}
        <span className="ml-1 text-xs opacity-80">▾</span>
      </ErpButton>

      {open ? (
        <div className="absolute bottom-full left-0 z-30 mb-2 min-w-[180px] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <button
            type="button"
            onClick={() => select(false)}
            className="block w-full px-4 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            VAT 미포함
            <span className="mt-0.5 block text-xs font-normal text-slate-500">VAT 0 · 총합계 = 공급가액</span>
          </button>
          <button
            type="button"
            onClick={() => select(true)}
            className="block w-full border-t border-slate-100 px-4 py-2.5 text-left text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            VAT 포함
            <span className="mt-0.5 block text-xs font-normal text-slate-500">VAT 10% · 총합계에 포함</span>
          </button>
        </div>
      ) : null}
    </div>
  )
}
