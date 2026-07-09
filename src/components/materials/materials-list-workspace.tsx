'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { MaterialFetchError } from '@/components/materials/material-fetch-error'
import { MaterialListTable } from '@/components/materials/material-list-table'
import { MaterialModal } from '@/components/materials/material-modal'
import type { FetchMaterialsResult } from '@/lib/materials/repository'
import type { Material } from '@/lib/materials/types'
import { barcodeMatchesPart, getMaterialMpnCandidates, normalizeBarcodeScanInput, stripBarcodePartPrefix } from '@/lib/materials/utils'

type MaterialsListWorkspaceProps = {
  result: FetchMaterialsResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; material: Material }

function matchesQuery(material: Material, query: string, normalizedQuery: string) {
  if (!query) return true
  const haystack = [
    material.customer,
    material.materialName,
    material.specification,
    material.type,
    material.id,
    ...getMaterialMpnCandidates(material),
    material.supplier,
    material.supplyType,
  ]
    .join(' ')
    .toLowerCase()
  if (haystack.includes(query)) return true
  if (normalizedQuery && normalizedQuery !== query && haystack.includes(normalizedQuery)) return true
  // 릴 바코드 스캔 시 앞에 붙는 1P/30P 접두어를 제거한 값으로도 매칭
  const stripped = stripBarcodePartPrefix(query)
  if (stripped !== query && haystack.includes(stripped)) return true
  // 스캔값 뒤에 패키지/릴 코드가 붙은 경우(등록 부품번호가 스캔값의 앞부분)
  return [material.id, ...getMaterialMpnCandidates(material)].some((part) =>
    barcodeMatchesPart(query, part) || (normalizedQuery ? barcodeMatchesPart(normalizedQuery, part) : false),
  )
}

export function MaterialsListWorkspace({ result }: MaterialsListWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)
  const materials = result.ok ? result.materials : []
  const query = search.trim().toLowerCase()
  const normalizedQuery = normalizeBarcodeScanInput(search).toLowerCase()

  const filtered = useMemo(
    () => materials.filter((material) => matchesQuery(material, query, normalizedQuery)),
    [materials, query, normalizedQuery],
  )

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(material: Material) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', material })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved() {
    closeModal()
    router.refresh()
  }

  function handleDeleted() {
    closeModal()
    router.refresh()
  }

  return (
    <>
      <div className="flex min-h-[calc(100vh-60px)] w-full flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">자재목록</h1>
            <p className="mt-1 text-sm text-slate-500">
              자재 마스터(등록 시트) — 고객사·품번·공급업체 기준 품목 목록입니다.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {result.ok ? (
              <p className="text-sm font-medium text-slate-600">
                총 <span className="tabular-nums text-violet-700">{filtered.length.toLocaleString('ko-KR')}</span>건
                {query ? (
                  <span className="text-slate-400"> / {materials.length.toLocaleString('ko-KR')}건</span>
                ) : null}
              </p>
            ) : null}
            {result.ok ? (
              <button
                type="button"
                onClick={openCreate}
                className="inline-flex h-10 items-center rounded-lg bg-violet-600 px-4 text-sm font-semibold text-white shadow-sm hover:bg-violet-700"
              >
                자재 등록
              </button>
            ) : null}
          </div>
        </div>

        {result.ok ? (
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="고객사, 자재명, 자재코드, MPN, 공급업체·바코드 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-violet-100 placeholder:text-slate-400 focus:border-violet-300 focus:ring-2"
          />
        ) : null}

        {!result.ok ? (
          <MaterialFetchError result={result} />
        ) : (
          <MaterialListTable
            materials={filtered}
            emptyMessage={query ? '검색 결과가 없습니다' : '등록된 자재가 없습니다'}
            onSelectMaterial={openEdit}
          />
        )}
      </div>

      {modal.open ? (
        <MaterialModal
          key={`${modal.mode}-${modal.mode === 'edit' ? modal.material.id : 'create'}-${modalSession}`}
          open
          mode={modal.mode}
          material={modal.mode === 'edit' ? modal.material : undefined}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={modal.mode === 'edit' ? handleDeleted : undefined}
          onDataChanged={() => router.refresh()}
        />
      ) : null}
    </>
  )
}
