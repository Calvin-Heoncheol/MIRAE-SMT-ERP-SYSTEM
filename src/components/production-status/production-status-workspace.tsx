'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ProductionStatusQuickInputModal } from '@/components/production-status/production-status-quick-input-modal'
import { ProductionStatusTable } from '@/components/production-status/production-status-table'
import { ListPagination } from '@/components/ui/list-pagination'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchProductionStatusResult } from '@/lib/production-status/repository'
import type { ProductionStatusLine, ProductionStatusStage } from '@/lib/production-status/types'
import { useClientPagination } from '@/lib/ui/use-client-pagination'

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
  const lines = data?.lines ?? []
  const query = search.trim()
  const filteredLines = useMemo(() => {
    const q = query.toLowerCase()
    if (!q) return lines
    return lines.filter((line) =>
      [line.orderNumber, line.customer, line.productName].join(' ').toLowerCase().includes(q),
    )
  }, [lines, query])
  const pagination = useClientPagination(filteredLines)

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
    <div className="flex w-full flex-1 flex-col gap-4">
      <WorkspaceHeader
        totalCount={lines.length}
        filteredCount={filteredLines.length}
        hasQuery={Boolean(query)}
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="주문서번호, 고객사, 제품명 검색…"
        accent="slate"
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
        SMT·후공정 칸은 총관리자 직접 입력용입니다. 생산입력 화면과 별도이며, 등록 시 이력 비고에
        「직접생산(관리자)」가 남습니다. (로그인 연동 전 · 현재는 화면에서 모두 가능)
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
