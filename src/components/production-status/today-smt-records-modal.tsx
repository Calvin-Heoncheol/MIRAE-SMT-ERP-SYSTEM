'use client'

import { useEffect } from 'react'
import { TodaySmtRecordsTable } from '@/components/production-status/today-smt-records-table'
import type { SmtProductionHistoryRow } from '@/lib/smt/types'

type TodaySmtRecordsModalProps = {
  open: boolean
  todayDate: string
  records: SmtProductionHistoryRow[]
  onClose: () => void
}

export function TodaySmtRecordsModal({
  open,
  todayDate,
  records,
  onClose,
}: TodaySmtRecordsModalProps) {
  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const totalQuantity = records.reduce((sum, row) => sum + row.quantity, 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      onClick={onClose}
    >
      <div
        className="relative flex max-h-[88dvh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">오늘 SMT 등록 내역</h2>
            <p className="mt-1 text-sm text-slate-500">
              {todayDate} · {records.length.toLocaleString('ko-KR')}건 ·{' '}
              {totalQuantity.toLocaleString('ko-KR')}개
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50"
          >
            닫기
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-6">
          <TodaySmtRecordsTable records={records} />
        </div>
      </div>
    </div>
  )
}
