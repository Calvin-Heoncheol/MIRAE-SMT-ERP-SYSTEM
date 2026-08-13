'use client'

import { useMemo, useState } from 'react'
import { LegacyQuoteModal } from '@/components/quotes/legacy-quote-modal'
import { QuoteListTable } from '@/components/quotes/quote-list-table'
import { QuoteModal } from '@/components/quotes/quote-modal'
import { QuoteNewMenu } from '@/components/quotes/quote-toolbar'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { PageShell } from '@/components/ui/page-shell'
import { WorkspaceHeader } from '@/components/ui/workspace-header'
import { useBusy } from '@/components/ui/busy-provider'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import type { FetchQuotesResult } from '@/lib/quotes/repository'
import { updateQuoteStatus } from '@/lib/quotes/repository'
import type { QuoteListItem, QuoteType } from '@/lib/quotes/types'
import { filterQuotesForSearch, isLegacyQuoteDetail } from '@/lib/quotes/utils'
import { formatEmptyListMessage } from '@/lib/ui/tokens'

type QuotationsWorkspaceProps = {
  result: FetchQuotesResult
}

type ModalState =
  | { open: false }
  | { open: true; variant: 'standard'; mode: 'create'; quoteType: QuoteType }
  | { open: true; variant: 'standard'; mode: 'edit'; quoteType: QuoteType; quote: QuoteListItem }
  | { open: true; variant: 'legacy'; mode: 'create' }
  | { open: true; variant: 'legacy'; mode: 'edit'; quote: QuoteListItem }

export function QuotationsWorkspace({ result }: QuotationsWorkspaceProps) {
  const { afterSave, afterDelete } = useSaveFeedback()
  const busyUi = useBusy()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const [search, setSearch] = useState('')
  const [modal, setModal] = useState<ModalState>({ open: false })
  const [modalSession, setModalSession] = useState(0)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)

  const quotes = result.ok ? result.quotes : []
  const query = search.trim()
  const filtered = useMemo(() => filterQuotesForSearch(quotes, query), [quotes, query])
  const existingQuoteNumbers = quotes.map((quote) => quote.quoteNumber)

  function openCreate(quoteType: QuoteType) {
    setModalSession((value) => value + 1)
    setModal({ open: true, variant: 'standard', mode: 'create', quoteType })
  }

  function openLegacyCreate() {
    setModalSession((value) => value + 1)
    setModal({ open: true, variant: 'legacy', mode: 'create' })
  }

  function openEdit(quote: QuoteListItem) {
    setModalSession((value) => value + 1)
    if (isLegacyQuoteDetail(quote.detailInfo)) {
      setModal({ open: true, variant: 'legacy', mode: 'edit', quote })
      return
    }
    setModal({ open: true, variant: 'standard', mode: 'edit', quoteType: quote.quoteType, quote })
  }

  function closeModal() {
    setModal({ open: false })
  }

  function handleSaved(message?: string) {
    afterSave(message ?? '견적서가 저장되었습니다.', { close: closeModal })
  }

  function handleDeleted(message?: string) {
    afterDelete(message ?? '견적서가 삭제되었습니다.', { close: closeModal })
  }

  async function handleToggleStatus(quote: QuoteListItem) {
    const nextStatus = quote.quoteStatus === 'confirmed' ? 'draft' : 'confirmed'
    setStatusBusyId(quote.quoteNumber)
    const saveResult = await busyUi.run(() =>
      updateQuoteStatus(quote.quoteNumber, nextStatus, quote.detailInfo),
    )
    setStatusBusyId(null)
    if (!saveResult.ok) {
      notifyAuthOrFailure(saveResult, { toastAllFailures: true, title: '상태 변경 실패' })
      return
    }
    afterSave(nextStatus === 'confirmed' ? '견적서가 확정되었습니다.' : '견적서가 미확정으로 변경되었습니다.')
  }

  if (!result.ok) {
    return <QuoteFetchError result={result} />
  }

  return (
    <>
      <PageShell>
        <WorkspaceHeader
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder="견적번호, 고객사, 제품명, 상태, 견적일 검색…"
          accent="slate"
          actions={<QuoteNewMenu onOpenNew={openCreate} onOpenLegacy={openLegacyCreate} />}
        />

        <QuoteListTable
          quotes={filtered}
          emptyMessage={formatEmptyListMessage({
            hasQuery: Boolean(query),
            emptyLabel: '등록된 견적서가 없습니다',
            actionHint: '오른쪽 상단에서 등록하세요',
          })}
          onSelectQuote={openEdit}
          onToggleStatus={(quote) => void handleToggleStatus(quote)}
          statusBusyId={statusBusyId}
        />
      </PageShell>

      {modal.open && modal.variant === 'standard' ? (
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

      {modal.open && modal.variant === 'legacy' ? (
        <LegacyQuoteModal
          key={
            modal.mode === 'edit'
              ? `legacy-edit-${modal.quote.quoteNumber}-${modalSession}`
              : `legacy-create-${modalSession}`
          }
          open
          mode={modal.mode}
          quote={modal.mode === 'edit' ? modal.quote : null}
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
    <FetchErrorBanner
      reason={result.reason}
      title="견적 목록을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        isMissingTable ? (
          <>
            Supabase SQL Editor에서 <code className="rounded bg-white/70 px-1">supabase/setup-quotations.sql</code>{' '}
            을 실행해 주세요.
          </>
        ) : null
      }
    />
  )
}
