'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ProductionStatusQuickInputModal } from '@/components/production-status/production-status-quick-input-modal'
import { ProductionStatusTable } from '@/components/production-status/production-status-table'
import { TodayProductionOverview } from '@/components/production-status/today-production-overview'
import type { FetchProductionStatusResult } from '@/lib/production-status/repository'
import type { ProductionStatusLine, ProductionStatusStage } from '@/lib/production-status/types'

type ProductionStatusWorkspaceProps = {
  result: FetchProductionStatusResult
}

type QuickInputState = {
  stage: ProductionStatusStage
  line: ProductionStatusLine
} | null

export function ProductionStatusWorkspace({ result }: ProductionStatusWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [quickInput, setQuickInput] = useState<QuickInputState>(null)
  const [, startTransition] = useTransition()

  const data = result.ok ? result.data : null
  const filteredLines = useMemo(() => {
    const lines = data?.lines ?? []
    const q = search.trim().toLowerCase()
    if (!q) return lines
    return lines.filter((line) =>
      [line.orderNumber, line.customer, line.productName].join(' ').toLowerCase().includes(q),
    )
  }, [data?.lines, search])

  function handleStageClick(line: ProductionStatusLine, stage: ProductionStatusStage) {
    setQuickInput({ stage, line })
  }

  function handleRegistered() {
    startTransition(() => {
      router.refresh()
    })
  }

  if (!result.ok) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="font-semibold">
          {result.reason === 'env' ? '환경변수 필요' : '생산현황을 불러오지 못했습니다'}
        </p>
        <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-[calc(100dvh-60px)] w-full flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">생산현황</h1>
      </div>

      <TodayProductionOverview
        todayDate={data!.todayDate}
        stages={data!.todayStages}
        todaySmtRecords={data!.todaySmtRecords}
      />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-base font-bold text-slate-800">주문서별 진행</h2>
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="주문서번호, 고객사, 제품명 검색…"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm shadow-sm outline-none ring-sky-100 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2"
        />
      </div>

      <ProductionStatusTable lines={filteredLines} onStageClick={handleStageClick} />

      <p className="text-xs text-slate-400">
        SMT·후공정·출하 그래프를 누르면 생산계획 없이 바로 입력할 수 있습니다. SMT는 반제품 라인
        합계, 후공정·출하는 완제품 조립 합계 기준입니다.
      </p>

      <ProductionStatusQuickInputModal
        open={Boolean(quickInput)}
        stage={quickInput?.stage ?? 'smt'}
        line={quickInput?.line ?? null}
        smtOrders={data!.smtOrders}
        postOrders={data!.postOrders}
        deliveryOrders={data!.deliveryOrders}
        smtCounts={data!.smtCounts}
        postCounts={data!.postCounts}
        deliveryAvailabilityByGroupId={data!.deliveryAvailabilityByGroupId}
        onClose={() => setQuickInput(null)}
        onRegistered={handleRegistered}
      />
    </div>
  )
}
