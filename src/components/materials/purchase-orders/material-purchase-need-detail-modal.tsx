'use client'

import { useEffect, useMemo, useState } from 'react'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { ErpButton } from '@/components/ui/erp-button'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ErpModal } from '@/components/ui/erp-modal'
import { FilterChipBar, STATUS_FILTER_TONES } from '@/components/ui/filter-chip'
import { StatusBadge } from '@/components/ui/status-badge'
import type { MaterialPurchaseNeedCard } from '@/lib/materials/purchase-orders/types'
import { ERP_TABLE_HEAD_CLASS, ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'

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
  const confirm = useErpConfirm()
  const [filter, setFilter] = useState<'all' | '부족' | '충분'>('all')

  useEffect(() => {
    if (!open) setFilter('all')
  }, [open])

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

  async function handleDelete() {
    if (!onDelete || deleting) return
    if (
      !(await confirm({
        title: '발주서 카드 삭제',
        message: `${card.orderNumber} 발주서 카드를 삭제할까요?\n\n구매발주 화면에서만 삭제되며, 고객 발주·재고·기존 구매발주 데이터는 그대로 유지됩니다.`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }
    void onDelete(card)
  }

  return (
    <ErpModal
      open={open}
      size="lg"
      title="구매발주 필요 자재"
      description={`${card.orderNumber} · ${card.customer || '—'} · ${card.productLabel} · 수량 ${card.productQuantity.toLocaleString('ko-KR')}`}
      onClose={onClose}
      closeOnEscape={!deleting}
      footer={
        <div className="flex w-full flex-col gap-2">
          <p className="text-sm text-slate-500">
            부족 {card.shortageCount.toLocaleString('ko-KR')}종 · 충분{' '}
            {card.sufficientCount.toLocaleString('ko-KR')}종
          </p>
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {onDelete ? (
              <ErpButton
                variant="danger"
                onClick={() => void handleDelete()}
                disabled={deleting}
                loading={deleting}
              >
                삭제
              </ErpButton>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <ErpButton variant="secondary" onClick={onClose} disabled={deleting}>
                닫기
              </ErpButton>
              {onCreateShortageOrder && card.shortageCount > 0 ? (
                <ErpButton onClick={() => onCreateShortageOrder(card)} disabled={deleting}>
                  부족분 구매발주
                </ErpButton>
              ) : null}
            </div>
          </div>
        </div>
      }
    >
      {deleteError ? (
        <div className="mb-3 rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-sm text-red-700">
          {deleteError}
        </div>
      ) : null}

      <div className="mb-3">
        <FilterChipBar options={filterOptions} value={filter} onChange={setFilter} />
      </div>

      {!filteredLines.length ? (
        <EmptyListState message="표시할 자재가 없습니다" />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="erp-data-table erp-data-table--compact min-w-[980px] w-full table-fixed border-collapse text-sm">
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
            <thead className={ERP_TABLE_HEAD_CLASS}>
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                  상태
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                  자재코드
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                  자재명
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                  규격
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-left text-xs font-semibold text-slate-500">
                  공급사
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                  소요
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
                  현재고
                </th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right text-xs font-semibold text-slate-500">
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
                      tone={line.status === '부족' ? 'danger' : 'success'}
                    />
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-mono text-xs text-slate-700">
                    {line.materialCode}
                  </td>
                  <td className={`px-3 py-2.5 text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    {line.materialName}
                  </td>
                  <td className={`px-3 py-2.5 text-slate-600 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    {line.specification || '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-slate-600 ${ERP_TABLE_TD_WRAP_CLASS}`}>
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
    </ErpModal>
  )
}
