'use client'

import { ERP_PDF_BUTTON_CLASS } from '@/lib/ui/tokens'

type PdfDownloadButtonProps = {
  onDownload: () => void
  disabled?: boolean
  /** 기본 PDF. 견적 영문 등 라벨 변경용 */
  label?: string
}

/** 전 페이지 공통 PDF 내보내기 — 로즈 */
export function PdfDownloadButton({
  onDownload,
  disabled = false,
  label = 'PDF',
}: PdfDownloadButtonProps) {
  return (
    <button
      type="button"
      onClick={onDownload}
      disabled={disabled}
      className={ERP_PDF_BUTTON_CLASS}
    >
      {label}
    </button>
  )
}
