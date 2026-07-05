'use client'

import { useMemo, useState } from 'react'
import { ProductionFetchError } from '@/components/production-input/production-fetch-error'
import { ProductionInputPanel } from '@/components/production-input/production-input-panel'
import { ProductionOrderSidebar } from '@/components/production-input/production-order-sidebar'
import type { FetchProductionInputPageResult } from '@/lib/production-input/repository'
import type { ProductionInputConfig } from '@/lib/production-input/types'
import { filterProductionOrders } from '@/lib/production-input/utils'

type ProductionInputWorkspaceProps = {
  result: FetchProductionInputPageResult
  config: ProductionInputConfig
}

export function ProductionInputWorkspace({ result, config }: ProductionInputWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState('')
  const [counts, setCounts] = useState<Record<string, number>>(() =>
    result.ok ? result.data.counts : {},
  )

  const data = result.ok ? result.data : null
  const filtered = useMemo(
    () => filterProductionOrders(data?.orders ?? [], search),
    [data?.orders, search],
  )

  const selectedOrder = useMemo(
    () =>
      filtered.find((order) => order.uiKey === selectedKey) ??
      data?.orders.find((order) => order.uiKey === selectedKey) ??
      null,
    [data?.orders, filtered, selectedKey],
  )

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleSelect(uiKey: string) {
    setSelectedKey(uiKey)
  }

  if (!result.ok) {
    return <ProductionFetchError result={result} config={config} />
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md max-lg:flex-col lg:grid lg:grid-cols-[minmax(320px,480px)_minmax(0,1fr)] lg:min-h-[calc(100vh-200px)]">
      <ProductionOrderSidebar
        orders={filtered}
        counts={counts}
        selectedKey={selectedKey}
        search={search}
        page={page}
        onSearchChange={handleSearchChange}
        onSelect={handleSelect}
        onPageChange={setPage}
      />
      <div className="min-h-[420px] min-w-0 lg:min-h-0">
        <ProductionInputPanel
          order={selectedOrder}
          counts={counts}
          config={config}
          onCountUpdated={(countKey, cumulative) => {
            setCounts((current) => ({ ...current, [countKey]: cumulative }))
          }}
        />
      </div>
    </div>
  )
}
