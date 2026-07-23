'use client'

import { useEffect, useMemo, useState } from 'react'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { StatusBadge } from '@/components/ui/status-badge'
import type { MaterialPurchaseNeedCard } from '@/lib/materials/purchase-orders/types'

type MaterialPurchaseNeedDetailModalProps = {
  open: boolean
  card: MaterialPurchaseNeedCard
  onClose: () => void
  onCreateShortageOrder?: (card: MaterialPurchaseNeedCard) => void
  onDelete?: (card: MaterialPurchaseNeedCard) => void | Promise<void>
  deleting?: boolean
  deleteError?: string | null
}

export function MaterialPurchaseNeedDetailModal({
  open,
  card,
  onClose,
  onCreateShortageOrder,
  onDelete,
  deleting = false,
  deleteError = null,
}: MaterialPurchaseNeedDetailModalProps) {
  const [filter, setFilter] = useState<'all' | '부족' | '충분'>('all')

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !deleting) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose, deleting])

  const filteredLines = useMemo(() => {
    if (filter === 'all') return card.lines
    return card.lines.filter((line) => line.status === filter)
  }, [card.lines, filter])

  const filterOptions = useMemo(
    () => [
      { value: 'all' as const, label: '전체', count: card.materialCount },
      {
        value: '부족' as const,
        label: '부족',
        count: card.shortageCount,
        tone: {
          idleClassName: 'border border-rose-200 bg-rose-50 text-rose-800 hover:bg-rose-100',
          activeClassName: 'bg-rose-700 text-white shadow-sm',
          activeCountClassName: 'text-rose-100',
        },
      },
      {
        value: '충분' as const,
        label: '충분',
        count: card.sufficientCount,
        tone: STATUS_FILTER_TONES.done,
      },
    ],
    [card.materialCount, card.shortageCount, card.sufficientCount],
  )

  function handleDelete() {
    if (!onDelete || deleting) return
    if (
      !window.confirm(
        `${card.orderNumber} 주문서 카드를 삭제할까요?\n\n자재 발주 화면에서만 삭제되며, 고객 주문·재고·기존 발주 데이터는 그대로 유지됩니다.`,
      )
    ) {
      return
    }
    void onDelete(card)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-need-detail-title"
        className="flex max-h-[94dvh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="purchase-need-detail-title" className="text-lg font-bold text-slate-900">
              발주 필요 자재
            </h2>
            <p className="mt-1 font-mono text-sm font-semibold text-slate-700">{card.orderNumber}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {card.customer || '—'} · {card.productLabel} · 수량{' '}
              {card.productQuantity.toLocaleString('ko-KR')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="inline-flex items-center rounded-lg border border-red-200 bg-white px-3.5 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {deleting ? '삭제 중…' : '삭제'}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onClose}
              disabled={deleting}
              className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        {deleteError ? (
          <div className="border-b border-red-100 bg-red-50 px-5 py-2.5 text-sm text-red-700">
            {deleteError}
          </div>
        ) : null}

        <div className="border-b border-slate-100 px-5 py-3">
          <FilterChipBar options={filterOptions} value={filter} onChange={setFilter} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!filteredLines.length ? (
            <EmptyListState message="표시할 자재가 없습니다" />
          ) : (
            <div className="overflow-x-auto rounded-lg border border-slate-200">
              <table className="min-w-[980px] w-full table-fixed border-collapse text-sm">
                <colgroup>
                  <col className="w-[72px]" />
                  <col className="w-[120px]" />
                  <col className="w-[180px]" />
                  <col className="w-[140px]" />
                  <col className="w-[120px]" />
                  <col className="w-[88px]" />
                  <col className="w-[88px]" />
                  <col className="w-[88px]" />
                </colgroup>
                <thead className="bg-slate-50">
                  <tr>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      상태
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      자재코드
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      자재명
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      규격
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      공급사
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      소요
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      현재고
                    </th>
                    <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold tracking-wide text-slate-500 uppercase">
                      부족
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((line) => (
                    <tr key={line.materialId} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-3 py-2.5">
                        <StatusBadge
                          label={line.status}
                          className={
                            line.status === '부족'
                              ? 'bg-rose-100 text-rose-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }
                        />
                      </td>
                      <td className="truncate whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-700">
                        {line.materialCode}
                      </td>
                      <td className="truncate px-3 py-2.5 text-slate-800" title={line.materialName}>
                        {line.materialName}
                      </td>
                      <td
                        className="truncate px-3 py-2.5 text-slate-600"
                        title={line.specification || undefined}
                      >
                        {line.specification || '—'}
                      </td>
                      <td className="truncate whitespace-nowrap px-3 py-2.5 text-slate-600">
                        {line.supplier || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-800">
                        {line.requiredQuantity.toLocaleString('ko-KR')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2.5 text-right tabular-nums text-slate-800">
                        {line.onHandQuantity.toLocaleString('ko-KR')}
                      </td>
                      <td
                        className={[
                          'whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums',
                          line.shortageQuantity > 0 ? 'text-rose-700' : 'text-emerald-700',
                        ].join(' ')}
                      >
                        {line.shortageQuantity > 0
                          ? line.shortageQuantity.toLocaleString('ko-KR')
                          : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-5 py-4">
          <p className="text-sm text-slate-500">
            부족 {card.shortageCount.toLocaleString('ko-KR')}종 · 충분{' '}
            {card.sufficientCount.toLocaleString('ko-KR')}종
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              닫기
            </button>
            {onCreateShortageOrder && card.shortageCount > 0 ? (
              <button
                type="button"
                onClick={() => onCreateShortageOrder(card)}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900"
              >
                부족분 발주
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
