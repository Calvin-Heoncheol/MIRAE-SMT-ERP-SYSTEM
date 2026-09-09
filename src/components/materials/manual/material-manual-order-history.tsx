'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import {
  deleteMaterialManualHistory,
  fetchMaterialManualHistoryByOrderLine,
} from '@/lib/materials/manual/repository'
import type { MaterialManualHistoryRow } from '@/lib/materials/manual/types'
import { materialManualHistoryKindLabel } from '@/lib/materials/manual/utils'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import {
  ERP_BADGE_COMPACT_CLASS,
  ERP_TABLE_CLASS,
  ERP_TABLE_COMPACT_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_ROW_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TH_CLASS,
} from '@/lib/ui/tokens'

type MaterialManualOrderHistoryProps = {
  order: ProductionOrderLine | null
  refreshKey?: number
  onHistoryChanged?: () => void
}

function kindBadgeClass(kind: MaterialManualHistoryRow['kind']) {
  if (kind === 'inbound') return 'bg-amber-50 text-amber-800 ring-amber-200'
  return 'bg-sky-50 text-sky-800 ring-sky-200'
}

function HistoryTable({
  rows,
  canDelete,
  deletingId,
  onDelete,
}: {
  rows: MaterialManualHistoryRow[]
  canDelete: boolean
  deletingId: string
  onDelete: (row: MaterialManualHistoryRow) => void
}) {
  if (!rows.length) {
    return <p className="px-3 py-6 text-center text-xs text-slate-400">등록 이력이 없습니다.</p>
  }

  return (
    <table className={`${ERP_TABLE_CLASS} ${ERP_TABLE_COMPACT_CLASS} w-full bg-slate-50`}>
      <thead className={ERP_TABLE_HEAD_CLASS}>
        <tr>
          <th className={ERP_TABLE_TH_CLASS}>일자</th>
          <th className={ERP_TABLE_TH_CLASS}>구분</th>
          <th className={ERP_TABLE_TH_CLASS}>수량</th>
          <th className={ERP_TABLE_TH_CLASS}>등록</th>
          {canDelete ? <th className={`${ERP_TABLE_TH_CLASS} w-8`} /> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.id} className={ERP_TABLE_ROW_CLASS}>
            <td className={`${ERP_TABLE_TD_CLASS} tabular-nums text-slate-700`}>
              {row.recordDate || '—'}
            </td>
            <td className={ERP_TABLE_TD_CLASS}>
              <span className={`${ERP_BADGE_COMPACT_CLASS} ${kindBadgeClass(row.kind)}`}>
                {materialManualHistoryKindLabel(row.kind)}
              </span>
            </td>
            <td className={`${ERP_TABLE_TD_CLASS} text-xs font-semibold tabular-nums text-slate-800`}>
              +{row.quantity.toLocaleString('ko-KR')}
            </td>
            <td className={`${ERP_TABLE_TD_CLASS} text-[11px] text-slate-500`}>
              {row.createdByName || '—'}
            </td>
            {canDelete ? (
              <td className={`${ERP_TABLE_TD_CLASS} px-1 text-center`}>
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  disabled={Boolean(deletingId)}
                  aria-label={`${materialManualHistoryKindLabel(row.kind)} 이력 삭제`}
                  className="inline-flex h-6 w-6 items-center justify-center rounded text-base leading-none text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                >
                  {deletingId === row.id ? '…' : '×'}
                </button>
              </td>
            ) : null}
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export function MaterialManualOrderHistory({
  order,
  refreshKey = 0,
  onHistoryChanged,
}: MaterialManualOrderHistoryProps) {
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState<MaterialManualHistoryRow[]>([])
  const [deletingId, setDeletingId] = useState('')

  useEffect(() => {
    if (!order) {
      setRows([])
      setError('')
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      const result = await fetchMaterialManualHistoryByOrderLine(order!.orderLineId)
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        setError(result.detail)
        setRows([])
        return
      }
      setRows(result.rows)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [order?.uiKey, order?.orderLineId, refreshKey])

  async function handleDelete(row: MaterialManualHistoryRow) {
    if (
      !(await confirm({
        title: `${materialManualHistoryKindLabel(row.kind)} 이력 삭제`,
        message: `${row.recordDate || '—'} · ${row.quantity.toLocaleString('ko-KR')}세트 기록을 삭제할까요?`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeletingId(row.id)
    setError('')
    const result = await deleteMaterialManualHistory(row)
    setDeletingId('')
    if (!result.ok) {
      notifyAuthOrFailure(result, { toastAllFailures: true, title: '이력 삭제 실패' })
      setError(result.detail)
      return
    }

    setRows((current) => current.filter((item) => item.id !== row.id))
    onHistoryChanged?.()
  }

  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch border-t border-slate-200 bg-slate-50 lg:min-w-0 lg:flex-1 lg:border-t-0 lg:border-l">
      <div className="shrink-0 border-b border-slate-200 px-3 py-2.5">
        <h3 className="text-sm font-bold text-slate-800">등록 이력</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">최근 입고·불출부터 표시합니다.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50">
        {loading ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">불러오는 중…</p>
        ) : error ? (
          <p className="px-3 py-6 text-center text-xs text-rose-600">{error}</p>
        ) : (
          <HistoryTable
            rows={rows}
            canDelete={canDelete}
            deletingId={deletingId}
            onDelete={(row) => void handleDelete(row)}
          />
        )}
      </div>
    </aside>
  )
}
