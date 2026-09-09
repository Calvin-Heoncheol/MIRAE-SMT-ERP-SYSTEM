'use client'

import { useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { deleteMaterialManualHistory } from '@/lib/materials/manual/repository'
import type { MaterialManualHistoryRow } from '@/lib/materials/manual/types'
import { materialManualHistoryKindLabel } from '@/lib/materials/manual/utils'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import {
  ERP_BADGE_COMPACT_CLASS,
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_ROW_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type MaterialManualHistoryTableProps = {
  rows: MaterialManualHistoryRow[]
  emptyMessage: string
  onDeleted?: (rowId: string) => void
}

function kindBadgeClass(kind: MaterialManualHistoryRow['kind']) {
  if (kind === 'inbound') return 'bg-amber-50 text-amber-800 ring-amber-200'
  return 'bg-sky-50 text-sky-800 ring-sky-200'
}

function cell(value: string) {
  const trimmed = value.trim()
  return trimmed || '—'
}

export function MaterialManualHistoryTable({
  rows,
  emptyMessage,
  onDeleted,
}: MaterialManualHistoryTableProps) {
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const [deletingId, setDeletingId] = useState('')

  async function handleDelete(row: MaterialManualHistoryRow) {
    if (
      !(await confirm({
        title: `${materialManualHistoryKindLabel(row.kind)} 이력 삭제`,
        message: `${row.recordDate || '—'} · ${cell(row.productName)} · ${row.quantity.toLocaleString('ko-KR')}세트 기록을 삭제할까요?`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeletingId(row.id)
    const result = await deleteMaterialManualHistory(row)
    setDeletingId('')
    if (!result.ok) {
      notifyAuthOrFailure(result, { toastAllFailures: true, title: '이력 삭제 실패' })
      return
    }
    onDeleted?.(row.id)
  }

  if (!rows.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className={`${ERP_TABLE_CLASS} min-w-[960px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>기록일</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>구분</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>발주번호</th>
              <th className={ERP_TABLE_TH_CLASS}>고객사</th>
              <th className={ERP_TABLE_TH_CLASS}>제품명</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right`}>수량</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>등록자</th>
              {canDelete ? (
                <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} w-10`} />
              ) : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className={ERP_TABLE_ROW_CLASS}>
                <td
                  className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} tabular-nums text-slate-700`}
                >
                  {row.recordDate || '—'}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
                  <span className={`${ERP_BADGE_COMPACT_CLASS} ${kindBadgeClass(row.kind)}`}>
                    {materialManualHistoryKindLabel(row.kind)}
                  </span>
                </td>
                <td
                  className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-sm font-medium text-slate-900`}
                >
                  {cell(displayOrderPoNumber(row.customerPoNumber, row.orderNumber))}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} text-slate-700`}>
                  {cell(row.customer)}
                </td>
                <td
                  className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-medium text-slate-900`}
                >
                  {cell(row.productName)}
                </td>
                <td
                  className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-right text-sm font-semibold tabular-nums text-slate-800`}
                >
                  +{row.quantity.toLocaleString('ko-KR')}
                </td>
                <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-slate-600`}>
                  {cell(row.createdByName)}
                </td>
                {canDelete ? (
                  <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} px-1 text-center`}>
                    <button
                      type="button"
                      onClick={() => void handleDelete(row)}
                      disabled={Boolean(deletingId)}
                      aria-label={`${materialManualHistoryKindLabel(row.kind)} 이력 삭제`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded text-lg leading-none text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                    >
                      {deletingId === row.id ? '…' : '×'}
                    </button>
                  </td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
