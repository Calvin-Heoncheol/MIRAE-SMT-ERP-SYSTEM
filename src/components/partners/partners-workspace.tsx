'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PartnerFetchError } from '@/components/partners/partner-fetch-error'
import { PartnerListTable } from '@/components/partners/partner-list-table'
import { PartnerModal } from '@/components/partners/partner-modal'
import type { FetchBusinessPartnersResult } from '@/lib/partners/repository'
import { PARTNER_TRADE_ROLE_LABELS } from '@/lib/partners/types'
import { formatBusinessRegNo } from '@/lib/partners/utils'
import type { BusinessPartner } from '@/lib/partners/types'

type PartnersWorkspaceProps = {
  result: FetchBusinessPartnersResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create' }
  | { open: true; mode: 'edit'; partner: BusinessPartner }

function matchesQuery(partner: BusinessPartner, query: string) {
  if (!query) return true
  const haystack = [
    partner.businessRegNo,
    formatBusinessRegNo(partner.businessRegNo),
    partner.name,
    partner.representativeName,
    partner.businessType,
    partner.phone,
    PARTNER_TRADE_ROLE_LABELS[partner.tradeRole],
  ]
    .join(' ')
    .toLowerCase()
  return haystack.includes(query)
}

export function PartnersWorkspace({ result }: PartnersWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const partners = result.ok ? result.partners : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(
    () => partners.filter((partner) => matchesQuery(partner, query)),
    [partners, query],
  )

  function openCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create' })
  }

  function openEdit(partner: BusinessPartner) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', partner })
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

  if (!result.ok) {
    return <PartnerFetchError result={result} />
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">거래처등록</h1>
            <p className="mt-1 text-sm text-slate-500">사업자번호 기준 거래처 마스터를 관리합니다.</p>
          </div>
          <p className="text-sm font-medium text-slate-600">
            총 <span className="tabular-nums text-slate-900">{filtered.length.toLocaleString('ko-KR')}</span>건
            {query ? (
              <span className="text-slate-400"> / {partners.length.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="사업자번호, 거래처명, 대표자명, 업태, 전화 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-slate-100 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2"
          />
          <button
            type="button"
            onClick={openCreate}
            className="rounded-lg bg-slate-800 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-900"
          >
            거래처 등록
          </button>
        </div>

        <PartnerListTable
          partners={filtered}
          emptyMessage={query ? '검색 결과가 없습니다' : '등록된 거래처가 없습니다'}
          onSelectPartner={openEdit}
        />
      </div>

      {modal.open ? (
        <PartnerModal
          key={`${modal.mode}-${modal.mode === 'edit' ? modal.partner.businessRegNo : 'create'}-${modalSession}`}
          open
          mode={modal.mode}
          partner={modal.mode === 'edit' ? modal.partner : null}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}
