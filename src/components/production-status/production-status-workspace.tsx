'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ProductionStatusQuickInputModal } from '@/components/production-status/production-status-quick-input-modal'
import { ProductionStatusTable } from '@/components/production-status/production-status-table'
import { ListPagination } from '@/components/ui/list-pagination'
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

export function ProductionStatusWorkspace({ result }: ProductionStatusWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')
  const [quickInput, setQuickInput] = useState<QuickInputState>(null)
  const [, startTransition] = useTransition()

  const data = result.ok ? result.data : null
  const lines = data?.lines ?? []
  const query = search.trim()

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

  const doneCount = useMemo(() => lines.filter(isLineDeliveryComplete).length, [lines])
  const statusChips: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'active', label: '진행중', count: lines.length - doneCount },
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
    <div className="flex w-full flex-1 flex-col gap-4">
      <WorkspaceHeader
        totalCount={lines.length}
        filteredCount={filteredLines.length}
        hasQuery={Boolean(query)}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="주문서번호, 고객사, 제품명 검색…"
        accent="slate"
        filters={
          <div className="flex flex-wrap gap-2">
            {statusChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                onClick={() => setStatusFilter(chip.key)}
                className={[
                  'rounded-full px-4 py-1.5 text-sm font-semibold transition-colors',
                  statusFilter === chip.key
                    ? 'bg-slate-800 text-white shadow-sm'
                    : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50',
                ].join(' ')}
              >
                {chip.label}{' '}
                <span className={statusFilter === chip.key ? 'text-slate-300' : 'text-slate-400'}>
                  {chip.count.toLocaleString('ko-KR')}
                </span>
              </button>
            ))}
          </div>
        }
      />

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
        SMT·후공정·출하 칸은 총관리자 직접 입력용입니다. 생산입력 화면과 별도이며, 등록 시 이력 비고에
        「직접생산(관리자)」또는 「직접출하(관리자)」가 남습니다. (로그인 연동 전 · 현재는 화면에서 모두 가능)
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
    </div>
  )
}
