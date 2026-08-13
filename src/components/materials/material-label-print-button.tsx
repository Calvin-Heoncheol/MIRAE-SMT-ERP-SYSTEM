'use client'

import { useState } from 'react'
import { printMaterialLabels, type MaterialLabelPrintItem } from '@/lib/materials/print-material-labels'

type MaterialLabelPrintButtonProps = {
  items: MaterialLabelPrintItem[]
  /** 기본 매수 (릴 수 등) */
  defaultCopies?: number
  className?: string
  disabled?: boolean
}

export function MaterialLabelPrintButton({
  items,
  defaultCopies = 1,
  className = '',
  disabled = false,
}: MaterialLabelPrintButtonProps) {
  const [copies, setCopies] = useState(String(Math.max(1, defaultCopies)))

  const printableItems = items.filter((item) => item.id.trim())

  function handlePrint() {
    const count = Math.max(1, Math.floor(Number(copies) || 1))
    printMaterialLabels(
      printableItems.map((item) => ({
        ...item,
        copies: item.copies ?? count,
      })),
    )
  }

  if (!printableItems.length) return null

  const usesPerItemCopies = printableItems.some((item) => item.copies != null && item.copies > 0)

  return (
    <div className={`flex flex-wrap items-center gap-2 ${className}`}>
      {!usesPerItemCopies ? (
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          <span className="font-medium">매수</span>
          <input
            type="text"
            inputMode="numeric"
            value={copies}
            onChange={(event) => setCopies(event.target.value.replace(/[^\d]/g, ''))}
            className="h-9 w-16 rounded-lg border border-slate-200 px-2 text-right text-sm outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100"
          />
        </label>
      ) : null}
      <button
        type="button"
        onClick={handlePrint}
        disabled={disabled}
        className="h-9 rounded-lg border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
      >
        바코드 라벨 출력
      </button>
    </div>
  )
}
