'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ProductionStatusQuickInputModal } from '@/components/production-status/production-status-quick-input-modal'
import { ProductionStatusTable } from '@/components/production-status/production-status-table'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchProductionStatusResult } from '@/lib/production-status/repository'
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
  ProductionStatusStage,
} from '@/lib/production-status/types'

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

      <div className="min-h-0 flex-1 overflow-hidden">
        <ProductionStatusTable lines={filteredLines} onStageClick={handleStageClick} />
      </div>

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
