'use client'

import { useMemo, useState } from 'react'
import { ProductionStatusTable } from '@/components/production-status/production-status-table'
import { TodayProductionOverview } from '@/components/production-status/today-production-overview'
import type { FetchProductionStatusResult } from '@/lib/production-status/repository'

type ProductionStatusWorkspaceProps = {
  result: FetchProductionStatusResult
}

export function ProductionStatusWorkspace({ result }: ProductionStatusWorkspaceProps) {
  const [search, setSearch] = useState('')

  const data = result.ok ? result.data : null
  const filteredLines = useMemo(() => {
    const lines = data?.lines ?? []
    const q = search.trim().toLowerCase()
    if (!q) return lines
    return lines.filter((line) =>
      [line.orderNumber, line.customer, line.productName].join(' ').toLowerCase().includes(q),
    )
  }, [data?.lines, search])

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
    <div className="flex min-h-[calc(100vh-60px)] w-full flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">생산현황</h1>
        <p className="mt-1 text-sm text-slate-500">
          오늘 생산 실적과 주문서별 SMT · 후공정 · 출하 진행을 확인합니다.
        </p>
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

      <ProductionStatusTable lines={filteredLines} />

      <p className="text-xs text-slate-400">
        SMT는 주문서 내 반제품 라인 합계 기준입니다. 후공정·출하는 해당 주문서의 완제품 조립 합계 기준입니다.
      </p>
    </div>
  )
}
