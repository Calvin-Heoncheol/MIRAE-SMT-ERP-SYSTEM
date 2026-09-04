'use client'

import { useEffect, useState } from 'react'
import { fetchPostProcessProductionHistoryByAssemblyGroup } from '@/lib/post-process/repository'
import type { PostProcessProductionHistoryRow } from '@/lib/post-process/types'
import type { PostProcessTeam } from '@/lib/post-process/teams'
import type { ProductionInputConfig, ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionHistoryDateTime } from '@/lib/production-history/utils'
import { fetchSmtProductionHistoryByOrderLine } from '@/lib/smt/repository'
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
}

function formatQty(good: number, defect: number) {
  const parts = [`+${good.toLocaleString('ko-KR')}`]
  if (defect > 0) parts.push(`불량 ${defect.toLocaleString('ko-KR')}`)
  return parts.join(' · ')
}

function SmtHistoryTable({
  rows,
  highlightPcbSide,
}: {
  rows: SmtProductionHistoryRow[]
  highlightPcbSide?: SmtPcbSide | null
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
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => {
          const side = row.pcbSide === 'TOP' || row.pcbSide === 'BOT' ? row.pcbSide : 'SINGLE'
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
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function PostProcessHistoryTable({ rows }: { rows: PostProcessProductionHistoryRow[] }) {
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
}: ProductionInputOrderHistoryProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
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
          <PostProcessHistoryTable rows={postRows} />
        ) : (
          <SmtHistoryTable rows={smtRows} highlightPcbSide={highlightPcbSide} />
        )}
      </div>
    </aside>
  )
}
