'use client'

type PdfDownloadButtonProps = {
  onDownload: () => void
  disabled?: boolean
}

export function PdfDownloadButton({ onDownload, disabled = false }: PdfDownloadButtonProps) {
  return (
    <button
      type="button"
      onClick={onDownload}
      disabled={disabled}
      className="rounded-lg bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
    >
      PDF
    </button>
  )
}
