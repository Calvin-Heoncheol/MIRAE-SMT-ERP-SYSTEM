'use client'

import { useEffect, useState } from 'react'
import { useCanDeleteRecords } from '@/components/auth/auth-profile-provider'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { fetchPostProcessProductionHistoryByAssemblyGroup } from '@/lib/post-process/repository'
import { deletePostProcessProductionRecord } from '@/lib/post-process/repository'
import type { PostProcessProductionHistoryRow } from '@/lib/post-process/types'
import type { PostProcessTeam } from '@/lib/post-process/teams'
import type { ProductionInputConfig, ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionHistoryDateTime } from '@/lib/production-history/utils'
import { buildSmtCountKey } from '@/lib/smt/count-keys'
import {
  deleteSmtProductionRecord,
  fetchSmtProductionHistoryByOrderLine,
} from '@/lib/smt/repository'
import type { SmtProductionHistoryRow } from '@/lib/smt/types'
import type { SmtPcbSide } from '@/lib/smt/types'
import {
  ERP_TABLE_CLASS,
  ERP_TABLE_COMPACT_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_ROW_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TH_CLASS,
} from '@/lib/ui/tokens'

type ProductionInputOrderHistoryProps = {
  order: ProductionOrderLine | null
  config: Pick<ProductionInputConfig, 'productionModule'>
  postProcessTeam?: PostProcessTeam
  highlightPcbSide?: SmtPcbSide | null
  refreshKey?: number
  onCountUpdated?: (countKey: string, cumulative: number, defectCumulative?: number) => void
}

function formatQty(good: number, defect: number) {
  const parts = [`+${good.toLocaleString('ko-KR')}`]
  if (defect > 0) parts.push(`불량 ${defect.toLocaleString('ko-KR')}`)
  return parts.join(' · ')
}

function resolveSmtSide(row: SmtProductionHistoryRow): SmtPcbSide {
  return row.pcbSide === 'TOP' || row.pcbSide === 'BOT' ? row.pcbSide : 'SINGLE'
}

function sumSmtSideTotals(rows: SmtProductionHistoryRow[], side: SmtPcbSide) {
  let good = 0
  let defect = 0
  for (const row of rows) {
    if (resolveSmtSide(row) !== side) continue
    good += Math.max(0, Math.floor(Number(row.quantity) || 0))
    defect += Math.max(0, Math.floor(Number(row.defectQuantity) || 0))
  }
  return { good, defect }
}

function sumPostTotals(rows: PostProcessProductionHistoryRow[]) {
  let good = 0
  let defect = 0
  for (const row of rows) {
    good += Math.max(0, Math.floor(Number(row.quantity) || 0))
    defect += Math.max(0, Math.floor(Number(row.defectQuantity) || 0))
  }
  return { good, defect }
}

function SmtHistoryTable({
  rows,
  highlightPcbSide,
  canDelete,
  deletingId,
  onDelete,
}: {
  rows: SmtProductionHistoryRow[]
  highlightPcbSide?: SmtPcbSide | null
  canDelete: boolean
  deletingId: string
  onDelete: (row: SmtProductionHistoryRow) => void
}) {
  if (!rows.length) {
    return <p className="px-3 py-6 text-center text-xs text-slate-400">등록 이력이 없습니다.</p>
  }

  return (
    <table className={`${ERP_TABLE_CLASS} ${ERP_TABLE_COMPACT_CLASS} w-full bg-slate-50`}>
      <thead className={ERP_TABLE_HEAD_CLASS}>
        <tr>
          <th className={ERP_TABLE_TH_CLASS}>생산일</th>
          <th className={ERP_TABLE_TH_CLASS}>수량</th>
          <th className={ERP_TABLE_TH_CLASS}>면</th>
          <th className={ERP_TABLE_TH_CLASS}>등록</th>
          {canDelete ? <th className={`${ERP_TABLE_TH_CLASS} w-8`} /> : null}
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const side = resolveSmtSide(row)
          const highlighted =
            highlightPcbSide != null &&
            (highlightPcbSide === side ||
              (highlightPcbSide === 'SINGLE' && side === 'SINGLE'))
          return (
            <tr
              key={row.id}
              className={[ERP_TABLE_ROW_CLASS, highlighted ? 'bg-sky-50/80' : ''].join(' ')}
            >
              <td className={`${ERP_TABLE_TD_CLASS} tabular-nums text-slate-700`}>
                {row.recordDate || '—'}
              </td>
              <td className={`${ERP_TABLE_TD_CLASS} text-xs font-semibold tabular-nums text-slate-800`}>
                {formatQty(row.quantity, row.defectQuantity)}
              </td>
              <td className={`${ERP_TABLE_TD_CLASS} text-xs text-slate-600`}>
                {side}
                {row.lineNo ? ` · L${row.lineNo}` : ''}
              </td>
              <td className={`${ERP_TABLE_TD_CLASS} text-[11px] text-slate-500`}>
                <p>{row.createdByName || '—'}</p>
                <p className="tabular-nums">{formatProductionHistoryDateTime(row.createdAt)}</p>
              </td>
              {canDelete ? (
                <td className={`${ERP_TABLE_TD_CLASS} px-1 text-center`}>
                  <button
                    type="button"
                    onClick={() => onDelete(row)}
                    disabled={Boolean(deletingId)}
                    aria-label="생산 이력 삭제"
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-base leading-none text-slate-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-40"
                  >
                    {deletingId === row.id ? '…' : '×'}
                  </button>
                </td>
              ) : null}
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function PostProcessHistoryTable({
  rows,
  canDelete,
  deletingId,
  onDelete,
}: {
  rows: PostProcessProductionHistoryRow[]
  canDelete: boolean
  deletingId: string
  onDelete: (row: PostProcessProductionHistoryRow) => void
}) {
  if (!rows.length) {
    return <p className="px-3 py-6 text-center text-xs text-slate-400">등록 이력이 없습니다.</p>
  }

  return (
    <table className={`${ERP_TABLE_CLASS} ${ERP_TABLE_COMPACT_CLASS} w-full bg-slate-50`}>
      <thead className={ERP_TABLE_HEAD_CLASS}>
        <tr>
          <th className={ERP_TABLE_TH_CLASS}>생산일</th>
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
            <td className={`${ERP_TABLE_TD_CLASS} text-xs font-semibold tabular-nums text-slate-800`}>
              {formatQty(row.quantity, row.defectQuantity)}
            </td>
            <td className={`${ERP_TABLE_TD_CLASS} text-[11px] text-slate-500`}>
              <p>{row.createdByName || '—'}</p>
              <p className="tabular-nums">{formatProductionHistoryDateTime(row.createdAt)}</p>
              {row.note ? <p className="mt-0.5 text-slate-400">{row.note}</p> : null}
            </td>
            {canDelete ? (
              <td className={`${ERP_TABLE_TD_CLASS} px-1 text-center`}>
                <button
                  type="button"
                  onClick={() => onDelete(row)}
                  disabled={Boolean(deletingId)}
                  aria-label="생산 이력 삭제"
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

export function ProductionInputOrderHistory({
  order,
  config,
  postProcessTeam,
  highlightPcbSide = null,
  refreshKey = 0,
  onCountUpdated,
}: ProductionInputOrderHistoryProps) {
  const canDelete = useCanDeleteRecords()
  const confirm = useErpConfirm()
  const { notifyAuthOrFailure } = useWriteFailureToast()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState('')
  const [smtRows, setSmtRows] = useState<SmtProductionHistoryRow[]>([])
  const [postRows, setPostRows] = useState<PostProcessProductionHistoryRow[]>([])

  const isPostProcess = config.productionModule === 'post_process'

  useEffect(() => {
    if (!order) {
      setSmtRows([])
      setPostRows([])
      setError('')
      return
    }

    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')

      if (isPostProcess) {
        const groupId = order!.assemblyGroupId || order!.orderLineId
        const result = await fetchPostProcessProductionHistoryByAssemblyGroup(groupId, {
          team: postProcessTeam,
        })
        if (cancelled) return
        setLoading(false)
        if (!result.ok) {
          setError(result.detail)
          setPostRows([])
          return
        }
        setPostRows(result.rows)
        return
      }

      const result = await fetchSmtProductionHistoryByOrderLine(order!.orderLineId)
      if (cancelled) return
      setLoading(false)
      if (!result.ok) {
        setError(result.detail)
        setSmtRows([])
        return
      }
      setSmtRows(result.rows)
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [order?.uiKey, order?.orderLineId, order?.assemblyGroupId, isPostProcess, postProcessTeam, refreshKey])

  async function handleDeleteSmt(row: SmtProductionHistoryRow) {
    if (
      !(await confirm({
        title: '생산 이력 삭제',
        message: `${row.recordDate || '—'} · ${formatQty(row.quantity, row.defectQuantity)} 기록을 삭제할까요?`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeletingId(row.id)
    setError('')
    const result = await deleteSmtProductionRecord(row.id)
    setDeletingId('')
    if (!result.ok) {
      notifyAuthOrFailure(result, { toastAllFailures: true, title: '이력 삭제 실패' })
      setError(result.detail)
      return
    }

    const nextRows = smtRows.filter((item) => item.id !== row.id)
    setSmtRows(nextRows)
    const side = resolveSmtSide(row)
    const totals = sumSmtSideTotals(nextRows, side)
    onCountUpdated?.(buildSmtCountKey(row.orderLineId, side), totals.good, totals.defect)
  }

  async function handleDeletePost(row: PostProcessProductionHistoryRow) {
    if (
      !(await confirm({
        title: '생산 이력 삭제',
        message: `${row.recordDate || '—'} · ${formatQty(row.quantity, row.defectQuantity)} 기록을 삭제할까요?`,
        confirmLabel: '삭제',
        tone: 'danger',
      }))
    ) {
      return
    }

    setDeletingId(row.id)
    setError('')
    const result = await deletePostProcessProductionRecord(row.id)
    setDeletingId('')
    if (!result.ok) {
      notifyAuthOrFailure(result, { toastAllFailures: true, title: '이력 삭제 실패' })
      setError(result.detail)
      return
    }

    const nextRows = postRows.filter((item) => item.id !== row.id)
    setPostRows(nextRows)
    const totals = sumPostTotals(nextRows)
    const groupId = row.assemblyGroupId || order?.assemblyGroupId || order?.orderLineId || ''
    if (groupId) onCountUpdated?.(groupId, totals.good, totals.defect)
  }

  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col self-stretch border-t border-slate-200 bg-slate-50 lg:min-w-0 lg:flex-1 lg:border-t-0 lg:border-l">
      <div className="shrink-0 border-b border-slate-200 px-3 py-2.5">
        <h3 className="text-sm font-bold text-slate-800">등록 이력</h3>
        <p className="mt-0.5 text-[11px] text-slate-500">최근 등록부터 표시합니다.</p>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50">
        {loading ? (
          <p className="px-3 py-6 text-center text-xs text-slate-400">불러오는 중…</p>
        ) : error ? (
          <p className="px-3 py-6 text-center text-xs text-rose-600">{error}</p>
        ) : isPostProcess ? (
          <PostProcessHistoryTable
            rows={postRows}
            canDelete={canDelete}
            deletingId={deletingId}
            onDelete={(row) => void handleDeletePost(row)}
          />
        ) : (
          <SmtHistoryTable
            rows={smtRows}
            highlightPcbSide={highlightPcbSide}
            canDelete={canDelete}
            deletingId={deletingId}
            onDelete={(row) => void handleDeleteSmt(row)}
          />
        )}
      </div>
    </aside>
  )
}
