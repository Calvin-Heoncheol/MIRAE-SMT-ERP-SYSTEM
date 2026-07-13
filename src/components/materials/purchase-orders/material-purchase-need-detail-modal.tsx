'use client'

import { useEffect, useMemo, useState } from 'react'
import type { MaterialPurchaseNeedCard } from '@/lib/materials/purchase-orders/types'

type MaterialPurchaseNeedDetailModalProps = {
  open: boolean
  card: MaterialPurchaseNeedCard
  onClose: () => void
  onCreateShortageOrder?: (card: MaterialPurchaseNeedCard) => void
}

export function MaterialPurchaseNeedDetailModal({
  open,
  card,
  onClose,
  onCreateShortageOrder,
}: MaterialPurchaseNeedDetailModalProps) {
  const [filter, setFilter] = useState<'all' | '부족' | '충분'>('all')

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  const filteredLines = useMemo(() => {
    if (filter === 'all') return card.lines
    return card.lines.filter((line) => line.status === filter)
  }, [card.lines, filter])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="purchase-need-detail-title"
        className="flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-5 py-4">
          <div className="min-w-0">
            <h2 id="purchase-need-detail-title" className="text-lg font-bold text-slate-900">
              발주 필요 자재
            </h2>
            <p className="mt-1 font-mono text-sm font-semibold text-violet-700">{card.orderNumber}</p>
            <p className="mt-0.5 text-sm text-slate-600">
              {card.customer || '—'} · {card.productLabel} · 수량{' '}
              {card.productQuantity.toLocaleString('ko-KR')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 px-5 py-3">
          {(
            [
              { key: 'all', label: `전체 ${card.materialCount}` },
              { key: '부족', label: `부족 ${card.shortageCount}` },
              { key: '충분', label: `충분 ${card.sufficientCount}` },
            ] as const
          ).map((item) => {
            const active = filter === item.key
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setFilter(item.key)}
                className={[
                  'rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors',
                  active
                    ? item.key === '부족'
                      ? 'bg-rose-600 text-white'
                      : item.key === '충분'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-violet-600 text-white'
                    : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50',
                ].join(' ')}
              >
                {item.label}
              </button>
            )
          })}
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {!filteredLines.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 px-5 py-10 text-center text-sm text-slate-500">
              표시할 자재가 없습니다.
            </div>
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
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      상태
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      자재코드
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      자재명
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      규격
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-600">
                      공급사
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600">
                      소요
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600">
                      현재고
                    </th>
                    <th className="whitespace-nowrap px-3 py-2 text-right font-semibold text-slate-600">
                      부족
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLines.map((line) => (
                    <tr key={line.materialId} className="border-t border-slate-100">
                      <td className="whitespace-nowrap px-3 py-2">
                        <span
                          className={[
                            'inline-flex whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold',
                            line.status === '부족'
                              ? 'bg-rose-50 text-rose-700'
                              : 'bg-emerald-50 text-emerald-700',
                          ].join(' ')}
                        >
                          {line.status}
                        </span>
                      </td>
                      <td className="truncate whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-700">
                        {line.materialCode}
                      </td>
                      <td className="truncate px-3 py-2 text-slate-800" title={line.materialName}>
                        {line.materialName}
                      </td>
                      <td
                        className="truncate px-3 py-2 text-slate-600"
                        title={line.specification || undefined}
                      >
                        {line.specification || '—'}
                      </td>
                      <td className="truncate whitespace-nowrap px-3 py-2 text-slate-600">
                        {line.supplier || '—'}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-800">
                        {line.requiredQuantity.toLocaleString('ko-KR')}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-slate-800">
                        {line.onHandQuantity.toLocaleString('ko-KR')}
                      </td>
                      <td
                        className={[
                          'whitespace-nowrap px-3 py-2 text-right font-semibold tabular-nums',
                          line.shortageQuantity > 0 ? 'text-rose-600' : 'text-emerald-700',
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
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
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
