'use client'

import { useEffect, useState } from 'react'
import { CustomerCombobox } from '@/components/orders/customer-combobox'
import { LegacyQuoteReflectModal } from '@/components/quotes/legacy-quote-reflect-modal'
import { QuoteNumericInput } from '@/components/quotes/quote-numeric-input'
import {
  buildLegacyQuoteRowPayload,
  clampLegacyBoardCount,
  defaultLegacyBoardName,
  legacyFlagsFromProcessType,
  LEGACY_MAX_BOARD_COUNT,
  readLegacyBoardsFromQuote,
  readLegacyUnitPrice,
  resizeLegacyBoards,
} from '@/lib/quotes/build-quote-payload'
import { createQuote, deleteQuotes, updateQuote } from '@/lib/quotes/repository'
import type { QuoteListItem } from '@/lib/quotes/types'
import { fetchSalesBusinessPartners } from '@/lib/partners/repository'
import type { BusinessPartner } from '@/lib/partners/types'
import { resolvePartnerFromInput } from '@/lib/partners/utils'

type LegacyQuoteModalProps = {
  open: boolean
  mode: 'create' | 'edit'
  quote?: QuoteListItem | null
  onClose: () => void
  onSaved?: () => void
  onDeleted?: () => void
}

type FormState = {
  customer: string
  productName: string
  includeSmd: boolean
  includePost: boolean
  boardCount: string
  boards: Array<{ name: string; smtSide: 'single' | 'double' }>
  unitPrice: string
}

function createInitialForm(quote?: QuoteListItem | null): FormState {
  if (!quote) {
    return {
      customer: '',
      productName: '',
      includeSmd: false,
      includePost: false,
      boardCount: '1',
      boards: [{ name: '', smtSide: 'single' }],
      unitPrice: '0',
    }
  }

  const amounts = quote.detailInfo.amounts
  const boards = readLegacyBoardsFromQuote(quote.detailInfo)
  const flags = legacyFlagsFromProcessType(quote.detailInfo.settings?.processType, {
    smtCost: amounts?.smt ?? 0,
    postProcessCost: amounts?.assembly ?? 0,
  })
  const unitPrice = readLegacyUnitPrice({
    amounts: quote.detailInfo.amounts,
    settings: quote.detailInfo.settings,
    totalAmount: quote.totalAmount,
  })

  return {
    customer: quote.customer || '',
    productName: quote.productName || '',
    includeSmd: flags.includeSmd,
    includePost: flags.includePost,
    boardCount: String(boards.length),
    boards,
    unitPrice: String(unitPrice),
  }
}

function toWorkingQuote(
  base: QuoteListItem | null | undefined,
  quoteId: string,
  payload: ReturnType<typeof buildLegacyQuoteRowPayload>,
): QuoteListItem {
  return {
    quoteId,
    quoteNumber: quoteId,
    quoteDate: payload.quote_date,
    quoteType: 'legacy',
    customer: payload.customer,
    productName: payload.product_name,
    boardQty: payload.board_qty,
    totalAmount: payload.total_amount,
    detailInfo: payload.detail_info,
    createdAt: base?.createdAt || new Date().toISOString(),
  }
}

export function LegacyQuoteModal({
  open,
  mode,
  quote,
  onClose,
  onSaved,
  onDeleted,
}: LegacyQuoteModalProps) {
  if (!open) return null

  return (
    <LegacyQuoteModalContent
      mode={mode}
      quote={quote}
      onClose={onClose}
      onSaved={onSaved}
      onDeleted={onDeleted}
    />
  )
}

function LegacyQuoteModalContent({
  mode,
  quote,
  onClose,
  onSaved,
  onDeleted,
}: Omit<LegacyQuoteModalProps, 'open'>) {
  const [form, setForm] = useState<FormState>(() => createInitialForm(quote))
  const [workingQuote, setWorkingQuote] = useState<QuoteListItem | null>(quote || null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [salesPartners, setSalesPartners] = useState<BusinessPartner[]>([])
  const [partnersLoading, setPartnersLoading] = useState(true)
  const [reflectOpen, setReflectOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPartnersLoading(true)
    fetchSalesBusinessPartners().then((result) => {
      if (cancelled) return
      setPartnersLoading(false)
      if (result.ok) {
        setSalesPartners(result.partners)
      }
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting && !reflectOpen) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [onClose, deleting, reflectOpen])

  const linkedSemiIds =
    workingQuote?.detailInfo.settings?.linkedSemiItemIds?.filter(Boolean) ||
    (workingQuote?.detailInfo.settings?.linkedSemiItemId
      ? [workingQuote.detailInfo.settings.linkedSemiItemId]
      : [])
  const linkedFinishedId = workingQuote?.detailInfo.settings?.linkedFinishedItemId?.trim() || ''

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((current) => ({ ...current, [key]: value }))
  }

  function handleBoardCountChange(value: string) {
    setForm((current) => {
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || value === '') {
        return { ...current, boardCount: value }
      }
      const count = clampLegacyBoardCount(parsed)
      let boards = resizeLegacyBoards(current.boards, count)
      // 1개 → 여러 개로 늘릴 때 첫 보드명은 제품명으로
      if (count > 1 && current.boards.length <= 1) {
        const productName = current.productName.trim()
        boards = boards.map((board, index) =>
          index === 0
            ? {
                ...board,
                name: productName || defaultLegacyBoardName(0),
              }
            : board,
        )
      }
      if (count <= 1) {
        boards = [{ name: '', smtSide: boards[0]?.smtSide || 'single' }]
      }
      return {
        ...current,
        boardCount: String(count),
        boards,
      }
    })
  }

  function handleBoardCountBlur() {
    setForm((current) => {
      const count = clampLegacyBoardCount(Number(current.boardCount))
      let boards = resizeLegacyBoards(current.boards, count)
      if (count > 1 && current.boards.length <= 1) {
        const productName = current.productName.trim()
        boards = boards.map((board, index) =>
          index === 0
            ? {
                ...board,
                name: productName || defaultLegacyBoardName(0),
              }
            : board,
        )
      }
      if (count <= 1) {
        boards = [{ name: '', smtSide: boards[0]?.smtSide || 'single' }]
      }
      return {
        ...current,
        boardCount: String(count),
        boards,
      }
    })
  }

  function updateBoardSide(index: number, smtSide: 'single' | 'double') {
    setForm((current) => ({
      ...current,
      boards: current.boards.map((board, boardIndex) =>
        boardIndex === index ? { ...board, smtSide } : board,
      ),
    }))
  }

  function updateBoardName(index: number, name: string) {
    setForm((current) => ({
      ...current,
      boards: current.boards.map((board, boardIndex) =>
        boardIndex === index ? { ...board, name } : board,
      ),
    }))
  }

  function buildPayload(customerName: string) {
    const linkedIds =
      workingQuote?.detailInfo.settings?.linkedSemiItemIds ||
      quote?.detailInfo.settings?.linkedSemiItemIds
    const linkedSingle =
      workingQuote?.detailInfo.settings?.linkedSemiItemId ||
      quote?.detailInfo.settings?.linkedSemiItemId

    return buildLegacyQuoteRowPayload({
      customer: customerName,
      productName: form.productName,
      boards: form.boards,
      unitPrice: form.unitPrice,
      includeSmd: form.includeSmd,
      includePost: form.includePost,
      quoteDate: workingQuote?.quoteDate || (mode === 'edit' && quote?.quoteDate ? quote.quoteDate : undefined),
      linkedSemiItemId: linkedSingle,
      linkedSemiItemIds: linkedIds,
      linkedFinishedItemId:
        workingQuote?.detailInfo.settings?.linkedFinishedItemId ||
        quote?.detailInfo.settings?.linkedFinishedItemId,
    })
  }

  async function persistQuote(options?: { openReflect?: boolean }) {
    const resolvedPartner = resolvePartnerFromInput(salesPartners, form.customer)
    if (!resolvedPartner) {
      setSaveError('거래처등록에 등록된 매출 고객사만 선택할 수 있습니다.')
      return null
    }

    if (!form.productName.trim()) {
      setSaveError('제품명을 입력해 주세요.')
      return null
    }

    if (!form.includeSmd && !form.includePost) {
      setSaveError('SMD 또는 후공정 중 하나 이상 선택해 주세요.')
      return null
    }

    if (!form.boards.length) {
      setSaveError('보드 개수를 1 이상으로 입력해 주세요.')
      return null
    }

    const payload = buildPayload(resolvedPartner.name)

    setSaving(true)
    setSaveError(null)

    const existingId = workingQuote?.quoteNumber || (mode === 'edit' && quote ? quote.quoteNumber : null)
    const saveResult = existingId
      ? await updateQuote(existingId, payload)
      : await createQuote(payload, 'legacy')

    setSaving(false)

    if (!saveResult.ok) {
      setSaveError(saveResult.detail)
      return null
    }

    const nextQuote = toWorkingQuote(workingQuote || quote, saveResult.quoteId, payload)
    setWorkingQuote(nextQuote)

    if (options?.openReflect) {
      setReflectOpen(true)
      return nextQuote
    }

    onSaved?.()
    return nextQuote
  }

  async function handleSave() {
    await persistQuote({ openReflect: !workingQuote && mode === 'create' })
  }

  async function handleOpenReflect() {
    await persistQuote({ openReflect: true })
  }

  async function handleDelete() {
    const target = workingQuote || quote
    if (!target) return

    const confirmMessage = `${target.quoteNumber} 견적서를 삭제하시겠습니까?\n삭제 후에는 복구할 수 없습니다.`
    if (!window.confirm(confirmMessage)) return

    setDeleting(true)
    setSaveError(null)

    const deleteResult = await deleteQuotes([target.quoteNumber])
    setDeleting(false)

    if (!deleteResult.ok) {
      setSaveError(deleteResult.detail)
      return
    }

    onDeleted?.()
  }

  function handleReflectClose() {
    setReflectOpen(false)
    onSaved?.()
  }

  function handleReflectDone() {
    setReflectOpen(false)
    onSaved?.()
  }

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <button
          type="button"
          aria-label="닫기"
          className="absolute inset-0 bg-slate-900/40"
          onClick={() => {
            if (!reflectOpen) onClose()
          }}
        />
        <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
            <div>
              <h2 className="text-lg font-bold text-slate-900">
                {workingQuote || mode === 'edit' ? '(구) 견적서 수정' : '(구) 견적서 등록'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">간단 견적 · 원화 · 품목 연동용</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-2 py-1 text-sm text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            >
              닫기
            </button>
          </div>

          <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">고객사</span>
              <CustomerCombobox
                value={form.customer}
                partners={salesPartners}
                placeholder="거래처명 검색"
                inputClassName="w-full rounded-lg border border-slate-200 px-3 py-2"
                onValueChange={(value) => updateForm('customer', value)}
                onPartnerSelect={(partner) => updateForm('customer', partner.name)}
              />
              <p className="mt-1 text-xs text-slate-500">
                {partnersLoading
                  ? '매출 거래처 목록을 불러오는 중...'
                  : salesPartners.length === 0
                    ? '등록된 매출 거래처가 없습니다. 기초등록 → 거래처등록에서 먼저 등록해 주세요.'
                    : '거래처등록의 매출·매입/매출 거래처만 선택할 수 있습니다.'}
              </p>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">제품명</span>
              <input
                value={form.productName}
                onChange={(event) => updateForm('productName', event.target.value)}
                placeholder="제품명을 입력하세요"
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>

            <div>
              <span className="mb-1.5 block text-sm font-medium text-slate-600">공정 카테고리</span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => updateForm('includeSmd', !form.includeSmd)}
                  className={
                    form.includeSmd
                      ? 'rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white'
                      : 'rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50'
                  }
                >
                  SMD
                </button>
                <button
                  type="button"
                  onClick={() => updateForm('includePost', !form.includePost)}
                  className={
                    form.includePost
                      ? 'rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-semibold text-white'
                      : 'rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50'
                  }
                >
                  후공정
                </button>
              </div>
              <p className="mt-1 text-xs text-slate-500">둘 다 선택하면 SMD+후공정으로 품목에 반영됩니다.</p>
            </div>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">보드 개수</span>
              <QuoteNumericInput
                min={1}
                max={LEGACY_MAX_BOARD_COUNT}
                value={form.boardCount}
                onChange={handleBoardCountChange}
                onBlur={handleBoardCountBlur}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>

            {form.boards.length <= 1 ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-slate-600">단면/양면</span>
                <select
                  value={form.boards[0]?.smtSide || 'single'}
                  onChange={(event) =>
                    updateBoardSide(0, event.target.value === 'double' ? 'double' : 'single')
                  }
                  className="w-full rounded-lg border border-slate-200 px-3 py-2"
                >
                  <option value="single">단면</option>
                  <option value="double">양면</option>
                </select>
                <p className="mt-1 text-xs text-slate-500">보드가 1개이면 제품명이 곧 보드명입니다.</p>
              </label>
            ) : (
              <div className="space-y-2">
                <span className="block text-sm font-medium text-slate-600">보드별 이름 · 단면/양면</span>
                {form.boards.map((board, index) => (
                  <div
                    key={`board-${index}`}
                    className="grid grid-cols-1 gap-2 rounded-lg border border-slate-200 px-3 py-2.5 sm:grid-cols-[1fr_120px]"
                  >
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs font-medium text-slate-500">
                        보드 {index + 1} 이름
                      </span>
                      <input
                        value={board.name}
                        onChange={(event) => updateBoardName(index, event.target.value)}
                        placeholder={`예: MAIN, POWER…`}
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label className="block text-sm">
                      <span className="mb-1 block text-xs font-medium text-slate-500">단면/양면</span>
                      <select
                        value={board.smtSide}
                        onChange={(event) =>
                          updateBoardSide(index, event.target.value === 'double' ? 'double' : 'single')
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="single">단면</option>
                        <option value="double">양면</option>
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            )}

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">단가</span>
              <QuoteNumericInput
                min={0}
                value={form.unitPrice}
                onChange={(unitPrice) => updateForm('unitPrice', unitPrice)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2"
              />
            </label>

            {linkedSemiIds.length || linkedFinishedId ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs text-emerald-900">
                <p className="font-semibold">품목 연결됨</p>
                {linkedSemiIds.length ? (
                  <p className="mt-1">반제품: {linkedSemiIds.join(', ')}</p>
                ) : null}
                {linkedFinishedId ? <p className="mt-0.5">완제품: {linkedFinishedId}</p> : null}
              </div>
            ) : null}

            {saveError ? (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {saveError}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 px-5 py-4">
            <div className="flex flex-wrap gap-2">
              {(workingQuote || mode === 'edit') && (workingQuote || quote) ? (
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={handleDelete}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  {deleting ? '삭제 중…' : '삭제'}
                </button>
              ) : null}
              {(workingQuote || mode === 'edit') && (workingQuote || quote) ? (
                <button
                  type="button"
                  disabled={deleting || saving}
                  onClick={handleOpenReflect}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  품목 반영
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                취소
              </button>
              <button
                type="button"
                disabled={saving || deleting}
                onClick={handleSave}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
              >
                {saving
                  ? '저장 중…'
                  : mode === 'create' && !workingQuote
                    ? '저장 후 품목 반영'
                    : '저장'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {reflectOpen && workingQuote ? (
        <LegacyQuoteReflectModal
          open
          quote={workingQuote}
          formOverride={form}
          onClose={handleReflectClose}
          onDone={handleReflectDone}
        />
      ) : null}
    </>
  )
}
