'use client'

import { useMemo, useState } from 'react'
import { MaterialFetchError } from '@/components/materials/material-fetch-error'
import { MaterialListTable } from '@/components/materials/material-list-table'
import type { FetchMaterialsResult } from '@/lib/materials/repository'
import type { Material } from '@/lib/materials/types'

type MaterialsListWorkspaceProps = {
  result: FetchMaterialsResult
}

function matchesQuery(material: Material, query: string) {
  if (!query) return true
  const haystack = [
    material.customer,
    material.materialName,
    material.specification,
    material.process,
    material.cpn,
    material.mpn,
    material.mpn2,
    material.spn,
    material.spn2,
    material.supplier,
    material.supplyType,
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function MaterialsListWorkspace({ result }: MaterialsListWorkspaceProps) {
  const [search, setSearch] = useState('')
  const materials = result.ok ? result.materials : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => materials.filter((material) => matchesQuery(material, query)),
    [materials, query],
  )

  return (
    <div className="flex min-h-[calc(100vh-60px)] w-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">자재목록</h1>
          <p className="mt-1 text-sm text-slate-500">
            자재 마스터(등록 시트) — 고객사·품번·공급업체 기준 품목 목록입니다.
          </p>
        </div>
        {result.ok ? (
          <p className="text-sm font-medium text-slate-600">
            총 <span className="tabular-nums text-violet-700">{filtered.length.toLocaleString('ko-KR')}</span>건
            {query ? (
              <span className="text-slate-400"> / {materials.length.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
        ) : null}
      </div>

      {result.ok ? (
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="고객사, 자재명, CPN, MPN, 공급업체 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-violet-100 placeholder:text-slate-400 focus:border-violet-300 focus:ring-2"
          />
        </div>
      ) : null}

      {!result.ok ? (
        <MaterialFetchError result={result} />
      ) : (
        <MaterialListTable
          materials={filtered}
          emptyMessage={query ? '검색 결과가 없습니다' : '등록된 자재가 없습니다'}
        />
      )}
    </div>
  )
}
