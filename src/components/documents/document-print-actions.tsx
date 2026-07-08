'use client'

import { printDocumentById } from '@/lib/documents/print-document'

type DocumentPrintActionsProps = {
  printRootId?: string
  title: string
  disabled?: boolean
  disabledTitle?: string
}

export function DocumentPrintActions({
  printRootId = 'document-print-root',
  title,
  disabled = false,
  disabledTitle = '문서를 저장한 후에 인쇄할 수 있습니다.',
}: DocumentPrintActionsProps) {
  function handlePrint() {
    if (disabled) {
      window.alert(disabledTitle)
      return
    }

    void printDocumentById(printRootId, { title })
  }

  return (
    <button
      type="button"
      onClick={handlePrint}
      disabled={disabled}
      title={disabled ? disabledTitle : undefined}
      className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      인쇄
    </button>
  )
}
