'use client'

import { useState } from 'react'

type ExcelDownloadButtonProps = {
  onDownload: () => Promise<void>
  disabled?: boolean
}

export function ExcelDownloadButton({ onDownload, disabled = false }: ExcelDownloadButtonProps) {
  const [busy, setBusy] = useState(false)

  async function handleClick() {
    if (busy) return
    setBusy(true)
    try {
      await onDownload()
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || busy}
      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      {busy ? '내보내는 중…' : 'EXCEL'}
    </button>
  )
}
