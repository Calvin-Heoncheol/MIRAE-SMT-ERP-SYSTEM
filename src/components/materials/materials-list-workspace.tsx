'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { MaterialFetchError } from '@/components/materials/material-fetch-error'
import { MaterialBarcodeRegisterPanel } from '@/components/materials/material-barcode-register-panel'
import { MaterialListTable } from '@/components/materials/material-list-table'
import { MaterialModal } from '@/components/materials/material-modal'
import type { FetchMaterialsResult } from '@/lib/materials/repository'
import type { Material } from '@/lib/materials/types'
import { barcodeMatchesPart, stripBarcodePartPrefix } from '@/lib/materials/utils'

type MaterialsListWorkspaceProps = {
  result: FetchMaterialsResult
}

type ModalState = { open: false } | { open: true; material: Material }

function matchesQuery(material: Material, query: string) {
  if (!query) return true
  const haystack = [
    material.customer,
    material.materialName,
    material.specification,
    material.type,
    material.cpn,
    material.mpn,
    ...material.alternateMpns,
    material.supplier,
    material.supplyType,
  ]
    .join(' ')
    .toLowerCase()
  if (haystack.includes(query)) return true
  // 릴 바코드 스캔 시 앞에 붙는 1P/30P 접두어를 제거한 값으로도 매칭
  const stripped = stripBarcodePartPrefix(query)
  if (stripped !== query && haystack.includes(stripped)) return true
  // 스캔값 뒤에 패키지/릴 코드가 붙은 경우(등록 부품번호가 스캔값의 앞부분)
  return [material.cpn, material.mpn, ...material.alternateMpns].some((part) =>
    barcodeMatchesPart(query, part),
  )
}

export function MaterialsListWorkspace({ result }: MaterialsListWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)
  const materials = result.ok ? result.materials : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => materials.filter((material) => matchesQuery(material, query)),
    [materials, query],
  )

  function openEdit(material: Material) {
    setModalSession((value) => value + 1)
    setModal({ open: true, material })
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
          <div className="space-y-3">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="고객사, 자재명, CPN, MPN, 공급업체·바코드 검색…"
              className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-violet-100 placeholder:text-slate-400 focus:border-violet-300 focus:ring-2"
            />
            {query && filtered.length === 0 ? (
              <MaterialBarcodeRegisterPanel
                materials={materials}
                suggestedBarcode={search.trim()}
                onRegistered={() => router.refresh()}
              />
            ) : null}
          </div>
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
          key={`${modal.material.id}-${modalSession}`}
          open
          material={modal.material}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onDataChanged={() => router.refresh()}
        />
      ) : null}
    </>
  )
}
