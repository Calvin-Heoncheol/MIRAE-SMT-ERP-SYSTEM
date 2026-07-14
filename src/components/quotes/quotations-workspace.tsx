'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { QuoteListTable } from '@/components/quotes/quote-list-table'
import { QuoteModal } from '@/components/quotes/quote-modal'
import { QuoteNewMenu } from '@/components/quotes/quote-toolbar'
import type { FetchQuotesResult } from '@/lib/quotes/repository'
import type { QuoteListItem, QuoteType } from '@/lib/quotes/types'
import { filterQuotesForSearch } from '@/lib/quotes/utils'

type QuotationsWorkspaceProps = {
  result: FetchQuotesResult
}

type ModalState =
  | { open: false }
  | { open: true; mode: 'create'; quoteType: QuoteType }
  | { open: true; mode: 'edit'; quoteType: QuoteType; quote: QuoteListItem }

export function QuotationsWorkspace({ result }: QuotationsWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)

  const quotes = result.ok ? result.quotes : []
  const query = search.trim()
  const filtered = useMemo(() => filterQuotesForSearch(quotes, query), [quotes, query])
  const existingQuoteNumbers = quotes.map((quote) => quote.quoteNumber)

  function openCreate(quoteType: QuoteType) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'create', quoteType })
  }

  function openEdit(quote: QuoteListItem) {
    setModalSession((value) => value + 1)
    setModal({ open: true, mode: 'edit', quoteType: quote.quoteType, quote })
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
    return <QuoteFetchError result={result} />
  }

  return (
    <>
      <div className="flex w-full flex-col gap-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">견적서</h1>
          </div>
          <p className="text-sm font-medium text-slate-600">
            총 <span className="tabular-nums text-slate-900">{filtered.length.toLocaleString('ko-KR')}</span>건
            {query ? (
              <span className="text-slate-400"> / {quotes.length.toLocaleString('ko-KR')}건</span>
            ) : null}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="견적번호, 고객사, 제품명, 견적일 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-slate-100 placeholder:text-slate-400 focus:border-slate-400 focus:ring-2"
          />
          <div className="ml-auto shrink-0">
            <QuoteNewMenu onOpenNew={openCreate} />
          </div>
        </div>

        <QuoteListTable
          quotes={filtered}
          emptyMessage={query ? '검색 결과가 없습니다' : '등록된 견적서가 없습니다'}
          onSelectQuote={openEdit}
        />
      </div>

      {modal.open ? (
        <QuoteModal
          key={
            modal.mode === 'edit'
              ? `edit-${modal.quote.quoteNumber}-${modalSession}`
              : `create-${modal.quoteType}-${modalSession}`
          }
          open
          mode={modal.mode}
          quoteType={modal.mode === 'edit' ? modal.quote.quoteType : modal.quoteType}
          quote={modal.mode === 'edit' ? modal.quote : null}
          existingQuoteNumbers={existingQuoteNumbers}
          onClose={closeModal}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
        />
      ) : null}
    </>
  )
}

function QuoteFetchError({ result }: { result: Extract<FetchQuotesResult, { ok: false }> }) {
  const isMissingTable =
    result.detail.includes('quotations') || result.detail.includes('schema cache')

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : '견적 목록을 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {isMissingTable ? (
        <p className="mt-3 text-xs text-amber-800">
          Supabase SQL Editor에서 <code className="rounded bg-white/70 px-1">supabase/setup-quotations.sql</code>{' '}
          을 실행해 주세요.
        </p>
      ) : null}
    </div>
  )
}
