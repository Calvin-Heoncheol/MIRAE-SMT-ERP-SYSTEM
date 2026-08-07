'use client'

import { useState } from 'react'
import { ERP_EXCEL_BUTTON_CLASS } from '@/lib/ui/tokens'

type ExcelDownloadButtonProps = {
  onDownload: () => Promise<void>
  disabled?: boolean
}

/** 전 페이지 공통 Excel 내보내기 — 초록 */
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
      className={ERP_EXCEL_BUTTON_CLASS}
    >
      {busy ? '내보내는 중…' : 'EXCEL'}
    </button>
  )
}
