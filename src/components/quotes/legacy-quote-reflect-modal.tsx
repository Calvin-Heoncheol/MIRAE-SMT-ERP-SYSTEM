'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  applyLegacyQuoteItemReflect,
  linkedSemiIdsFromQuote,
} from '@/lib/quotes/apply-legacy-reflect'
import { formatQuoteKrw } from '@/lib/quotes/format'
import { readLegacyBoardsFromQuote, readLegacyUnitPrice } from '@/lib/quotes/build-quote-payload'
import {
  buildLegacyReflectDraft,
  findFinishedItemMatches,
  findSemiItemMatches,
  type LegacyReflectDraft,
} from '@/lib/quotes/reflect-legacy-items'
import type { QuoteListItem } from '@/lib/quotes/types'
import { fetchItems } from '@/lib/items/repository'
import type { Item } from '@/lib/items/types'
import {
  ITEM_PCB_SIDE_MODE_LABELS,
  ITEM_PROCESS_TYPE_LABELS,
} from '@/lib/items/types'

type FormOverride = {
  productName: string
  boards: Array<{ name: string; smtSide: 'single' | 'double' }>
  unitPrice: string
  includeSmd: boolean
  includePost: boolean
}

type LegacyQuoteReflectModalProps = {
  open: boolean
  quote: QuoteListItem
  formOverride?: FormOverride | null
  onClose: () => void
  onDone: () => void
}

type BoardChoiceState = {
  reuseSemiItemId: string
  updateSemiUnitPrice: boolean
}

export function LegacyQuoteReflectModal({
  open,
  quote,
  formOverride,
  onClose,
  onDone,
}: LegacyQuoteReflectModalProps) {
  if (!open) return null

  return (
    <LegacyQuoteReflectModalContent
      quote={quote}
      formOverride={formOverride}
      onClose={onClose}
      onDone={onDone}
    />
  )
}

function LegacyQuoteReflectModalContent({
  quote,
  formOverride,
  onClose,
  onDone,
}: Omit<LegacyQuoteReflectModalProps, 'open'>) {
  const [items, setItems] = useState<Item[]>([])
  const [loadingItems, setLoadingItems] = useState(true)
  const [applying, setApplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [boardChoices, setBoardChoices] = useState<BoardChoiceState[]>([])
  const [createFinished, setCreateFinished] = useState(false)
  const [reuseFinishedItemId, setReuseFinishedItemId] = useState('__new__')

  const draftResult = useMemo(() => {
    if (formOverride) {
      const processType =
        formOverride.includeSmd && formOverride.includePost
          ? 'smt_post'
          : formOverride.includeSmd
            ? 'smt'
            : formOverride.includePost
              ? 'post'
              : null
      return buildLegacyReflectDraft({
        productName: formOverride.productName,
        boards: formOverride.boards,
        unitPrice: Number(formOverride.unitPrice) || 0,
        processType,
      })
    }
    return buildLegacyReflectDraft({
      productName: quote.productName,
      boards: readLegacyBoardsFromQuote(quote.detailInfo),
      unitPrice: readLegacyUnitPrice({
        amounts: quote.detailInfo.amounts,
        settings: quote.detailInfo.settings,
        totalAmount: quote.totalAmount,
      }),
      processType: quote.detailInfo.settings?.processType ?? null,
    })
  }, [quote, formOverride])

  const draft: LegacyReflectDraft | null = 'error' in draftResult ? null : draftResult
  const draftError = 'error' in draftResult ? draftResult.error : null

  const alreadySemiIds = useMemo(() => linkedSemiIdsFromQuote(quote), [quote])
  const alreadySemiKey = alreadySemiIds.join('|')
  const alreadyFinishedId = quote.detailInfo.settings?.linkedFinishedItemId?.trim() || ''

  const finishedMatches = useMemo(
    () => (draft ? findFinishedItemMatches(items, draft.productName) : []),
    [items, draft],
  )

  useEffect(() => {
    let cancelled = false
    setLoadingItems(true)
    fetchItems(true).then((result) => {
      if (cancelled) return
      setLoadingItems(false)
      if (result.ok) setItems(result.items)
    })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!draft) {
      setBoardChoices([])
      return
    }

    setBoardChoices(
      draft.boards.map((board, index) => {
        const linkedId = alreadySemiIds[index] || ''
        if (linkedId) {
          return { reuseSemiItemId: linkedId, updateSemiUnitPrice: true }
        }
        const matches = findSemiItemMatches(items, board.itemName, board.pcbSideMode, draft.processType)
        const exact = matches.find((row) => row.score === 'exact')
        return {
          reuseSemiItemId: exact?.item.id || '__new__',
          updateSemiUnitPrice: true,
        }
      }),
    )
  }, [draft, items, alreadySemiKey])

  useEffect(() => {
    if (alreadyFinishedId) {
      setReuseFinishedItemId(alreadyFinishedId)
      setCreateFinished(true)
      return
    }
    if (finishedMatches[0]) {
      setReuseFinishedItemId(finishedMatches[0].id)
      return
    }
    setReuseFinishedItemId('__new__')
  }, [alreadyFinishedId, finishedMatches])

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !applying) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onClose, applying])

  function updateBoardChoice(index: number, patch: Partial<BoardChoiceState>) {
    setBoardChoices((current) =>
      current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)),
    )
  }

  async function handleApply() {
    if (!draft) {
      setError(draftError || '반영할 내용을 확인할 수 없습니다.')
      return
    }

    setApplying(true)
    setError(null)

    const result = await applyLegacyQuoteItemReflect({
      quote,
      draft,
      boardChoices: draft.boards.map((board, index) => ({
        boardIndex: board.index,
        reuseSemiItemId:
          boardChoices[index]?.reuseSemiItemId === '__new__'
            ? null
            : boardChoices[index]?.reuseSemiItemId || null,
        updateSemiUnitPrice:
          boardChoices[index]?.reuseSemiItemId !== '__new__' &&
          Boolean(boardChoices[index]?.updateSemiUnitPrice),
      })),
      createFinished,
      reuseFinishedItemId:
        createFinished && reuseFinishedItemId !== '__new__' ? reuseFinishedItemId : null,
    })

    setApplying(false)

    if (!result.ok) {
      setError(result.detail)
      return
    }

    onDone()
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="닫기"
        className="absolute inset-0 bg-slate-900/50"
        onClick={() => {
          if (!applying) onClose()
        }}
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">품목 반영</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            보드마다 반제품을 만들거나 기존 품목에 연결합니다. 완제품·BOM은 선택 사항입니다.
          </p>
        </div>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto px-5 py-5">
          {draftError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {draftError}
            </p>
          ) : null}

          {draft ? (
            <>
              <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
                <p className="font-semibold text-slate-900">{draft.productName}</p>
                <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-600">
                  <div className="flex justify-between gap-2">
                    <dt>보드 수</dt>
                    <dd className="font-medium text-slate-800">{draft.boards.length}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>공정</dt>
                    <dd className="font-medium text-slate-800">
                      {ITEM_PROCESS_TYPE_LABELS[draft.processType]}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt>단가</dt>
                    <dd className="font-semibold tabular-nums text-slate-900">
                      {formatQuoteKrw(draft.unitPrice)}
                    </dd>
                  </div>
                </dl>
                <p className="mt-2 text-[11px] text-slate-500">
                  보드가 여러 개이면 반제품 단가 = 단가 ÷ 보드 수 입니다.
                </p>
              </div>

              {loadingItems ? (
                <p className="text-xs text-slate-500">품목 목록 불러오는 중…</p>
              ) : (
                draft.boards.map((board, index) => {
                  const matches = findSemiItemMatches(
                    items,
                    board.itemName,
                    board.pcbSideMode,
                    draft.processType,
                  )
                  const choice = boardChoices[index]
                  const linkedId = alreadySemiIds[index]

                  return (
                    <div
                      key={`reflect-board-${board.index}`}
                      className="space-y-2 rounded-xl border border-slate-200 px-3 py-3"
                    >
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <p className="font-semibold text-slate-800">{board.itemName}</p>
                        <p className="text-xs text-slate-500">
                          {ITEM_PCB_SIDE_MODE_LABELS[board.pcbSideMode]} ·{' '}
                          {formatQuoteKrw(board.unitPrice)}
                        </p>
                      </div>
                      <select
                        value={choice?.reuseSemiItemId || '__new__'}
                        onChange={(event) =>
                          updateBoardChoice(index, { reuseSemiItemId: event.target.value })
                        }
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      >
                        <option value="__new__">새로 등록 (SFG- 자동채번)</option>
                        {linkedId && !matches.some((row) => row.item.id === linkedId) ? (
                          <option value={linkedId}>연결된 반제품 · {linkedId}</option>
                        ) : null}
                        {matches.map(({ item, score }) => (
                          <option key={item.id} value={item.id}>
                            {score === 'exact' ? '✓ ' : ''}
                            {item.id} · {item.name}
                            {score === 'exact' ? ' (일치)' : ' (이름만)'}
                          </option>
                        ))}
                      </select>
                      {choice && choice.reuseSemiItemId !== '__new__' ? (
                        <label className="flex items-start gap-2 text-xs text-slate-700">
                          <input
                            type="checkbox"
                            className="mt-0.5"
                            checked={choice.updateSemiUnitPrice}
                            onChange={(event) =>
                              updateBoardChoice(index, {
                                updateSemiUnitPrice: event.target.checked,
                              })
                            }
                          />
                          <span>기존 반제품 단가·면·공정을 이번 견적으로 갱신</span>
                        </label>
                      ) : null}
                    </div>
                  )
                })
              )}

              <label className="flex items-start gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={createFinished}
                  onChange={(event) => setCreateFinished(event.target.checked)}
                />
                <span>완제품도 만들고 BOM에 반제품(보드) 모두 연결 (선택)</span>
              </label>

              {createFinished ? (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">완제품</span>
                  <select
                    value={reuseFinishedItemId}
                    onChange={(event) => setReuseFinishedItemId(event.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2"
                  >
                    <option value="__new__">새로 등록 (FG- 자동채번)</option>
                    {alreadyFinishedId &&
                    !finishedMatches.some((item) => item.id === alreadyFinishedId) ? (
                      <option value={alreadyFinishedId}>
                        연결된 완제품 · {alreadyFinishedId}
                      </option>
                    ) : null}
                    {finishedMatches.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.id} · {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              ) : null}
            </>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-5 py-4">
          <button
            type="button"
            disabled={applying}
            onClick={onClose}
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            나중에
          </button>
          <button
            type="button"
            disabled={applying || !draft || loadingItems}
            onClick={handleApply}
            className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900 disabled:opacity-50"
          >
            {applying ? '반영 중…' : '반영'}
          </button>
        </div>
      </div>
    </div>
  )
}
