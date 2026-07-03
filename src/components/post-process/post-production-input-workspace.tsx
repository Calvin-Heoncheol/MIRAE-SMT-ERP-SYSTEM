'use client'

import { useMemo, useState } from 'react'
import { PostFetchError } from '@/components/post-process/post-fetch-error'
import { PostInputPanel } from '@/components/post-process/post-input-panel'
import { PostOrderSidebar } from '@/components/post-process/post-order-sidebar'
import type { FetchPostProcessPageResult } from '@/lib/post-process/repository'
import { filterPostOrders } from '@/lib/post-process/utils'

type PostProductionInputWorkspaceProps = {
  result: FetchPostProcessPageResult
}

export function PostProductionInputWorkspace({ result }: PostProductionInputWorkspaceProps) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selectedKey, setSelectedKey] = useState('')

  const data = result.ok ? result.data : null
  const filtered = useMemo(
    () => filterPostOrders(data?.orders ?? [], search),
    [data?.orders, search],
  )

  const selectedOrder = useMemo(
    () => filtered.find((order) => order.uiKey === selectedKey) ?? data?.orders.find((order) => order.uiKey === selectedKey) ?? null,
    [data?.orders, filtered, selectedKey],
  )

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(1)
  }

  function handleSelect(uiKey: string) {
    setSelectedKey(uiKey)
  }

  return (
    <div className="flex min-h-[calc(100vh-60px)] w-full flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">생산입력</h1>
        <p className="mt-1 text-sm text-slate-500">주문별 후공정 생산 수량을 등록합니다.</p>
      </div>

      {!result.ok ? (
        <PostFetchError result={result} />
      ) : (
        <div className="flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-slate-300 bg-white shadow-md max-lg:flex-col lg:grid lg:grid-cols-[minmax(320px,480px)_minmax(0,1fr)] lg:h-[calc(100vh-148px)]">
          <PostOrderSidebar
            orders={filtered}
            counts={data?.counts ?? {}}
            selectedKey={selectedKey}
            search={search}
            page={page}
            onSearchChange={handleSearchChange}
            onSelect={handleSelect}
            onPageChange={setPage}
          />
          <div className="min-h-[420px] min-w-0 lg:min-h-0">
            <PostInputPanel order={selectedOrder} counts={data?.counts ?? {}} />
          </div>
        </div>
      )}
    </div>
  )
}
