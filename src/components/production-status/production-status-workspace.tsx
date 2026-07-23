'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ProductionStatusQuickInputModal } from '@/components/production-status/production-status-quick-input-modal'
import { ProductionStatusTable } from '@/components/production-status/production-status-table'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { KpiStatCard } from '@/components/ui/kpi-stat-card'
import { ListPagination } from '@/components/ui/list-pagination'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
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

  const statusChips = [
    {
      value: 'active' as const,
      label: '진행중',
      count: activeCount,
      tone: STATUS_FILTER_TONES.progress,
    },
    { value: 'done' as const, label: '완료', count: doneCount, tone: STATUS_FILTER_TONES.done },
    { value: 'all' as const, label: '전체', count: lines.length },
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
    <PageShell className="gap-4">
      <WorkspaceHeader
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="주문서번호, 고객사, 제품명 검색…"
        accent="slate"
        filters={
          <FilterChipBar
            options={statusChips}
            value={statusFilter}
            onChange={setStatusFilter}
          />
        }
      />

      <section className="grid grid-cols-2 gap-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiStatCard label="진행중" value={activeCount} unit="건" />
        <KpiStatCard label="완료" value={doneCount} unit="건" tone="emerald" />
        <KpiStatCard label="전체" value={lines.length} unit="건" tone="slate" />
        <KpiStatCard label="평균 SMT" value={avgSmt} unit="%" tone="sky" />
        <KpiStatCard label="평균 후공정" value={avgPost} unit="%" tone="emerald" />
        <KpiStatCard label="평균 출하" value={avgDelivery} unit="%" tone="slate" />
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
