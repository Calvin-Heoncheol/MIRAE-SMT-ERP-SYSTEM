'use client'

import { useState } from 'react'
import { TodaySmtRecordsModal } from '@/components/production-status/today-smt-records-modal'
import type { TodayProductionStage } from '@/lib/production-status/types'
import type { SmtProductionHistoryRow } from '@/lib/smt/types'

const STAGE_STYLES: Record<
  TodayProductionStage['key'],
  { border: string; bg: string; text: string; hover: string }
> = {
  smt: {
    border: 'border-sky-200',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    hover: 'hover:border-sky-300 hover:shadow-sm',
  },
  post_process: {
    border: 'border-emerald-200',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    hover: '',
  },
  shipment: {
    border: 'border-violet-200',
    bg: 'bg-violet-50',
    text: 'text-violet-800',
    hover: '',
  },
}

type TodayProductionOverviewProps = {
  todayDate: string
  stages: TodayProductionStage[]
  todaySmtRecords: SmtProductionHistoryRow[]
}

export function TodayProductionOverview({
  todayDate,
  stages,
  todaySmtRecords,
}: TodayProductionOverviewProps) {
  const [smtModalOpen, setSmtModalOpen] = useState(false)

  function handleStageClick(stage: TodayProductionStage) {
    if (stage.key === 'smt' && stage.linked) {
      setSmtModalOpen(true)
    }
  }

  return (
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-slate-900">오늘 생산실적</h2>
            <p className="mt-0.5 text-sm text-slate-500">{todayDate} (KST)</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {stages.map((stage) => {
            const style = STAGE_STYLES[stage.key]
            const clickable = stage.key === 'smt' && stage.linked

            const content = (
              <>
                <p className="text-sm font-semibold text-slate-600">{stage.label}</p>
                {stage.linked ? (
                  <>
                    <p className={`mt-2 text-2xl font-bold tabular-nums ${style.text}`}>
                      {stage.quantity.toLocaleString('ko-KR')}
                      <span className="ml-1 text-sm font-semibold">개</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      등록 {stage.recordCount.toLocaleString('ko-KR')}건
                      {clickable ? ' · 클릭하여 상세 보기' : ''}
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-sm font-medium text-slate-400">DB 연동 후 표시</p>
                )}
              </>
            )

            if (clickable) {
              return (
                <button
                  key={stage.key}
                  type="button"
                  onClick={() => handleStageClick(stage)}
                  className={`rounded-xl border px-4 py-3 text-left transition ${style.border} ${style.bg} ${style.hover} cursor-pointer`}
                >
                  {content}
                </button>
              )
            }

            return (
              <div
                key={stage.key}
                className={`rounded-xl border px-4 py-3 ${style.border} ${style.bg}`}
              >
                {content}
              </div>
            )
          })}
        </div>
      </section>

      <TodaySmtRecordsModal
        open={smtModalOpen}
        todayDate={todayDate}
        records={todaySmtRecords}
        onClose={() => setSmtModalOpen(false)}
      />
    </>
  )
}
