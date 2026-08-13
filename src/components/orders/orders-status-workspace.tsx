'use client'

import { useMemo, useState } from 'react'
import {
  isOrderShipmentComplete,
  OrderStatusTable,
} from '@/components/orders/order-status-table'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import type { FetchProductionStatusResult } from '@/lib/production-status/repository'

type OrdersStatusWorkspaceProps = {
  result: FetchProductionStatusResult
}

type StatusFilter = 'active' | 'done' | 'all'

export function OrdersStatusWorkspace({ result }: OrdersStatusWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active')

  const lines = result.ok ? result.data.lines : []
  const query = search.trim()

  const doneCount = useMemo(() => lines.filter(isOrderShipmentComplete).length, [lines])
  const activeCount = lines.length - doneCount

  const statusFilteredLines = useMemo(() => {
    if (statusFilter === 'all') return lines
    if (statusFilter === 'done') return lines.filter(isOrderShipmentComplete)
    return lines.filter((line) => !isOrderShipmentComplete(line))
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

  if (!result.ok) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="font-semibold">
          {result.reason === 'env' ? '환경변수 필요' : '출하현황을 불러오지 못했습니다'}
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
        searchPlaceholder="발주ID, 고객사, 제품명 검색…"
        accent="slate"
        filters={
          <FilterChipBar options={statusChips} value={statusFilter} onChange={setStatusFilter} />
        }
      />

      <div className="min-h-0 flex-1 overflow-hidden">
        <OrderStatusTable
          lines={filteredLines}
          availabilityByGroupId={
            result.ok ? result.data.deliveryAvailabilityByGroupId : {}
          }
        />
      </div>
    </PageShell>
  )
}
