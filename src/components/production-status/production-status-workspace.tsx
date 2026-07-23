'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ProductionStatusQuickInputModal } from '@/components/production-status/production-status-quick-input-modal'
import { ProductionStatusTable } from '@/components/production-status/production-status-table'
import { ListPagination } from '@/components/ui/list-pagination'
import { PageShell } from '@/components/ui/page-shell'
import type { FetchProductionStatusResult } from '@/lib/production-status/repository'
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
  ProductionStatusStage,
} from '@/lib/production-status/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'

type ProductionStatusWorkspaceProps = {
  result: FetchProductionStatusResult
}

type QuickInputState = {
  stage: ProductionStatusStage
  line: ProductionStatusLine
  product?: ProductionStatusProductLine
} | null

type StatusFilter = 'active' | 'done' | 'all'

function isLineDeliveryComplete(line: ProductionStatusLine) {
  return line.deliveryTarget > 0 && line.deliveryProduced >= line.deliveryTarget
}

function averagePercent(lines: ProductionStatusLine[], pick: (line: ProductionStatusLine) => number) {
  if (!lines.length) return 0
  const sum = lines.reduce((acc, line) => acc + Math.max(0, pick(line)), 0)
  return Math.round(sum / lines.length)
}

function SummaryKpi({
  label,
  value,
  unit,
  tone = 'default',
}: {
  label: string
  value: number
  unit?: string
  tone?: 'default' | 'sky' | 'emerald' | 'slate'
}) {
  const valueClass =
    tone === 'sky'
      ? 'text-sky-700'
      : tone === 'emerald'
        ? 'text-emerald-700'
        : tone === 'slate'
          ? 'text-slate-700'
          : 'text-slate-900'

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4 shadow-sm">
      <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">{label}</p>
      <p className={`mt-2 text-2xl font-bold tabular-nums ${valueClass}`}>
        {value.toLocaleString('ko-KR')}
        {unit ? <span className="ml-1 text-sm font-semibold text-slate-400">{unit}</span> : null}
      </p>
    </div>
  )
}

export function ProductionStatusWorkspace({ result }: ProductionStatusWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [quickInput, setQuickInput] = useState<QuickInputState>(null)
  const [, startTransition] = useTransition()

  const data = result.ok ? result.data : null
  const lines = data?.lines ?? []
  const query = search.trim()

  const doneCount = useMemo(() => lines.filter(isLineDeliveryComplete).length, [lines])
  const activeCount = lines.length - doneCount

  const avgSmt = useMemo(() => averagePercent(lines, (line) => line.smtPercent), [lines])
  const avgPost = useMemo(() => averagePercent(lines, (line) => line.postPercent), [lines])
  const avgDelivery = useMemo(
    () => averagePercent(lines, (line) => line.deliveryPercent),
    [lines],
  )

  const statusFilteredLines = useMemo(() => {
    if (statusFilter === 'all') return lines
    if (statusFilter === 'done') return lines.filter(isLineDeliveryComplete)
    return lines.filter((line) => !isLineDeliveryComplete(line))
  }, [lines, statusFilter])

  const filteredLines = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return statusFilteredLines
    return statusFilteredLines.filter((line) => {
      const productNames = line.products.map((product) => product.productName).join(' ')
      const productCodes = line.products.map((product) => product.productCode).join(' ')
      return [line.orderNumber, line.customer, line.productName, productNames, productCodes]
        .join(' ')
        .toLowerCase()
        .includes(q)
    })
  }, [statusFilteredLines, query])
  const pagination = useClientPagination(filteredLines)

  const statusChips: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'active', label: '진행중', count: activeCount },
    { key: 'done', label: '완료', count: doneCount },
    { key: 'all', label: '전체', count: lines.length },
  ]

  function handleStageClick(
    line: ProductionStatusLine,
    stage: ProductionStatusStage,
    product?: ProductionStatusProductLine,
  ) {
    setQuickInput({ stage, line, product })
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
    <PageShell className="gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-wide text-slate-400 uppercase">Dashboard</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">주문별 현황</h1>
        </div>
        <p className="text-sm font-medium text-slate-500">
          표시 {filteredLines.length.toLocaleString('ko-KR')} / 전체{' '}
          {lines.length.toLocaleString('ko-KR')}
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
        <SummaryKpi label="진행중" value={activeCount} unit="건" />
        <SummaryKpi label="완료" value={doneCount} unit="건" tone="emerald" />
        <SummaryKpi label="전체" value={lines.length} unit="건" tone="slate" />
        <SummaryKpi label="평균 SMT" value={avgSmt} unit="%" tone="sky" />
        <SummaryKpi label="평균 후공정" value={avgPost} unit="%" tone="emerald" />
        <SummaryKpi label="평균 출하" value={avgDelivery} unit="%" tone="slate" />
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            {statusChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key)}
                className={[
                  'rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors',
                  statusFilter === chip.key
                    ? 'bg-slate-900 text-white shadow-sm'
                    : 'bg-slate-50 text-slate-600 ring-1 ring-slate-200 hover:bg-slate-100',
                ].join(' ')}
              >
                {chip.label}{' '}
                <span className={statusFilter === chip.key ? 'text-slate-300' : 'text-slate-400'}>
                  {chip.count.toLocaleString('ko-KR')}
                </span>
              </button>
            ))}
          </div>
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="주문서번호, 고객사, 제품명 검색…"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-2 focus:ring-slate-100 sm:max-w-xs"
          />
        </div>
      </section>

      <ProductionStatusTable lines={pagination.pageItems} onStageClick={handleStageClick} />

      <ListPagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        onPageChange={pagination.setPage}
        rangeStart={pagination.rangeStart}
        rangeEnd={pagination.rangeEnd}
        totalCount={pagination.totalCount}
      />

      <p className="text-xs text-slate-400">
        SMT·후공정·출하 칸을 클릭하면 생산실사(관리자) 입력을 할 수 있습니다. 등록 시 이력 비고에
        「생산실사(관리자)」또는 「직접출하(관리자)」가 남습니다.
      </p>

      <ProductionStatusQuickInputModal
        open={Boolean(quickInput)}
        stage={quickInput?.stage ?? 'smt'}
        line={quickInput?.line ?? null}
        product={quickInput?.product ?? null}
        smtOrders={data!.smtOrders}
        postOrders={data!.postOrders}
        deliveryOrders={data!.deliveryOrders}
        smtCounts={data!.smtCounts}
        postCounts={data!.postCounts}
        deliveryAvailabilityByGroupId={data!.deliveryAvailabilityByGroupId}
        onClose={() => setQuickInput(null)}
        onRegistered={handleRegistered}
      />
    </PageShell>
  )
}
