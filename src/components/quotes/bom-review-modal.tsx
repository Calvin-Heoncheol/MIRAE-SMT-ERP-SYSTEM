'use client'

import { useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import type { DipBoardForm } from '@/lib/quotes/form-state'
import { toNumericField } from '@/lib/quotes/form-state'
import {
  crossReferenceBomPickPlace,
  suggestDipCountsFromBom,
  type BomPickPlaceCrossRefRow,
} from '@/lib/quotes/cross-reference-bom-pick-place'
import type { AltiumBomAnalysis } from '@/lib/quotes/parse-altium-bom'
import { bomExcludeReasonLabel } from '@/lib/quotes/bom-dnp'
import type { AltiumPickPlaceAnalysis } from '@/lib/quotes/parse-altium-pick-place'

type BomReviewModalProps = {
  open: boolean
  analysis: AltiumBomAnalysis | null
  pickPlaceAnalysis?: AltiumPickPlaceAnalysis | null
  boardIndex?: number
  dipForms: DipBoardForm[]
  onClose: () => void
  onApply: (input: {
    analysis: AltiumBomAnalysis
    dipForms?: DipBoardForm[]
  }) => void
}

const STATUS_STYLES = {
  matched: 'bg-emerald-50/80',
  bom_only: 'bg-amber-50/90',
  pnp_only: 'bg-slate-50',
} as const

const STATUS_LABELS = {
  matched: '매칭',
  bom_only: 'BOM만',
  pnp_only: '좌표만',
} as const

function CrossRefRow({ row }: { row: BomPickPlaceCrossRefRow }) {
  const bomExcluded = Boolean(row.bomLine?.excluded)
  return (
    <tr className={bomExcluded ? 'bg-slate-100/90' : STATUS_STYLES[row.status]}>
      <td
        className={[
          'whitespace-nowrap px-2 py-2 font-mono text-xs',
          bomExcluded ? 'text-slate-500 line-through' : 'text-slate-800',
        ].join(' ')}
      >
        {row.designator}
      </td>
      <td className="px-2 py-2 text-xs text-slate-700">
        <div className="flex flex-wrap items-center gap-1">
          <span>{STATUS_LABELS[row.status]}</span>
          {bomExcluded ? (
            <span className="inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-300">
              미실장
            </span>
          ) : null}
        </div>
      </td>
      <td className="max-w-[120px] truncate px-2 py-2 text-xs text-slate-600" title={row.bomLine?.comment}>
        {row.bomLine?.comment || row.pickPlaceRow?.value || '—'}
      </td>
      <td className="max-w-[120px] truncate px-2 py-2 text-xs text-slate-600" title={row.bomLine?.footprint}>
        {row.bomLine?.footprint || row.pickPlaceRow?.package || '—'}
      </td>
      <td className="max-w-[180px] truncate px-2 py-2 text-xs text-slate-600" title={row.note}>
        {row.note || (bomExcluded && row.bomLine?.excludeReason
          ? bomExcludeReasonLabel(row.bomLine.excludeReason, row.bomLine)
          : '—')}
      </td>
    </tr>
  )
}

function BomLineRow({ line }: { line: AltiumBomAnalysis['lines'][number] }) {
  return (
    <tr className={line.excluded ? 'bg-slate-100/90 text-slate-400' : 'hover:bg-slate-50/80'}>
      <td className="whitespace-nowrap px-2 py-2 font-mono text-xs">
        <span className={line.excluded ? 'line-through' : 'text-slate-800'}>
          {line.designators.join(', ')}
        </span>
      </td>
      <td className="px-2 py-2 text-xs">
        {line.excluded ? (
          <span className="inline-flex flex-col gap-0.5">
            <span className="inline-flex w-fit rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
              미실장
            </span>
            <span className="text-[10px] text-slate-500">
              {bomExcludeReasonLabel(line.excludeReason ?? 'strikethrough', line)}
            </span>
          </span>
        ) : (
          <span className="text-emerald-700">실장</span>
        )}
      </td>
      <td className={`px-2 py-2 text-xs ${line.excluded ? 'line-through' : 'text-slate-700'}`}>
        {line.comment || '—'}
      </td>
      <td
        className={`max-w-[120px] truncate px-2 py-2 text-xs ${line.excluded ? 'line-through' : 'text-slate-600'}`}
        title={line.footprint}
      >
        {line.footprint || '—'}
      </td>
      <td className={`px-2 py-2 text-center text-xs tabular-nums ${line.excluded ? 'line-through' : 'text-slate-700'}`}>
        {line.quantity}
      </td>
      <td
        className={`max-w-[140px] truncate px-2 py-2 text-xs ${line.excluded ? 'line-through' : 'text-slate-600'}`}
        title={line.mpn}
      >
        {line.mpn || '—'}
      </td>
    </tr>
  )
}

export function BomReviewModal({
  open,
  analysis,
  pickPlaceAnalysis,
  boardIndex = 0,
  dipForms,
  onClose,
  onApply,
}: BomReviewModalProps) {
  const requestClose = useErpModalRequestClose()
  const [view, setView] = useState<'lines' | 'crossref'>('lines')
  const [showAllCrossRef, setShowAllCrossRef] = useState(false)
  const [applyDipSuggestion, setApplyDipSuggestion] = useState(true)

  useEffect(() => {
    if (open) {
      setView(pickPlaceAnalysis ? 'crossref' : 'lines')
      setShowAllCrossRef(false)
      setApplyDipSuggestion(true)
    }
  }, [open, analysis?.fileName, pickPlaceAnalysis?.fileName])

  const crossRef = useMemo(() => {
    if (!analysis || !pickPlaceAnalysis) return null
    return crossReferenceBomPickPlace(analysis, pickPlaceAnalysis)
  }, [analysis, pickPlaceAnalysis])

  const dipSuggestion = useMemo(() => {
    if (!analysis || !crossRef) return null
    return suggestDipCountsFromBom(analysis, crossRef)
  }, [analysis, crossRef])

  const visibleCrossRefRows = useMemo(() => {
    if (!crossRef) return []
    if (showAllCrossRef) return crossRef.rows
    return crossRef.rows.filter((row) => row.status !== 'matched')
  }, [crossRef, showAllCrossRef])

  if (!open || !analysis) return null

  function handleApply() {
    let nextDipForms: DipBoardForm[] | undefined

    if (applyDipSuggestion && dipSuggestion && dipForms[boardIndex]) {
      const board = dipForms[boardIndex]!
      nextDipForms = dipForms.map((item, index) =>
        index === boardIndex
          ? {
              ...item,
              dipGeneral: toNumericField(
                (Number(item.dipGeneral) || 0) + dipSuggestion.dipGeneral,
              ),
              dipConnector: toNumericField(
                (Number(item.dipConnector) || 0) + dipSuggestion.dipConnector,
              ),
            }
          : item,
      )
    }

    onApply({
      analysis,
      dipForms: nextDipForms,
    })
  }

  return (
    <ErpModal
      open
      size="wide"
      title="BOM 분석 결과"
      description={`${analysis.fileName} · ${analysis.summary.lineCount}라인 · ${analysis.summary.designatorCount}개 부품위치${analysis.summary.excludedDesignatorCount > 0 ? ` · 미실장 ${analysis.summary.excludedDesignatorCount}` : ''}`}
      onClose={onClose}
      zIndexClassName="z-[60]"
      contentClassName="px-5 py-4"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          {dipSuggestion && (dipSuggestion.dipGeneral > 0 || dipSuggestion.dipConnector > 0) ? (
            <label className="flex items-center gap-2 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={applyDipSuggestion}
                onChange={(event) => setApplyDipSuggestion(event.target.checked)}
              />
              DIP 수삽 제안 적용 (일반 {dipSuggestion.dipGeneral} · 커넥터 {dipSuggestion.dipConnector})
            </label>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={() => requestClose?.() ?? onClose()}>
              취소
            </ErpButton>
            <ErpButton onClick={handleApply}>견적서에 적용</ErpButton>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
          <span className="font-medium text-slate-700">
            {analysis.summary.lineCount}라인 · {analysis.summary.designatorCount}개 Designator
          </span>
          {crossRef ? (
            <>
              <span className="text-slate-400">|</span>
              <span className="text-emerald-700">매칭 {crossRef.matchedCount}</span>
              <span className="text-amber-700">BOM만 {crossRef.bomOnlyCount}</span>
              <span className="text-slate-600">좌표만 {crossRef.pnpOnlyCount}</span>
            </>
          ) : (
            <span className="text-slate-500">
              좌표 파일 업로드 시 교차 분석됩니다. 미실장은 BOM에서만 확인됩니다.
            </span>
          )}
        </div>

        {analysis.summary.warnings.length || crossRef?.warnings.length ? (
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-[11px] text-amber-900">
            {[...analysis.summary.warnings, ...(crossRef?.warnings || [])].map((warning) => (
              <li key={warning}>· {warning}</li>
            ))}
          </ul>
        ) : null}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setView('lines')}
            className={[
              'rounded-md px-3 py-1.5 text-xs font-semibold',
              view === 'lines' ? 'bg-violet-100 text-violet-900' : 'text-slate-600 hover:bg-slate-100',
            ].join(' ')}
          >
            BOM 라인
          </button>
          {crossRef ? (
            <button
              type="button"
              onClick={() => setView('crossref')}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-semibold',
                view === 'crossref' ? 'bg-violet-100 text-violet-900' : 'text-slate-600 hover:bg-slate-100',
              ].join(' ')}
            >
              좌표 교차분석
            </button>
          ) : null}
        </div>

        {view === 'lines' ? (
          <div className="max-h-[min(52vh,420px)] overflow-auto rounded-lg border border-slate-200">
            <table className="min-w-full border-collapse text-left">
              <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-600">
                <tr>
                  <th className="px-2 py-2">Designator</th>
                  <th className="px-2 py-2">상태</th>
                  <th className="px-2 py-2">Comment/Value</th>
                  <th className="px-2 py-2">Footprint</th>
                  <th className="px-2 py-2 text-center">Qty</th>
                  <th className="px-2 py-2">MPN</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analysis.lines.map((line) => (
                  <BomLineRow key={line.lineIndex} line={line} />
                ))}
              </tbody>
            </table>
          </div>
        ) : crossRef ? (
          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-sm font-semibold text-slate-900">
                교차분석 {showAllCrossRef ? '전체' : '불일치'}
              </h3>
              <button
                type="button"
                onClick={() => setShowAllCrossRef((current) => !current)}
                className="text-xs font-medium text-violet-700 hover:text-violet-900"
              >
                {showAllCrossRef ? '불일치만 보기' : `전체 보기 (${crossRef.rows.length}건)`}
              </button>
            </div>
            <div className="max-h-[min(52vh,420px)] overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full border-collapse text-left">
                <thead className="sticky top-0 bg-slate-50 text-[11px] font-semibold text-slate-600">
                  <tr>
                    <th className="px-2 py-2">Designator</th>
                    <th className="px-2 py-2">상태</th>
                    <th className="px-2 py-2">Value</th>
                    <th className="px-2 py-2">Footprint</th>
                    <th className="px-2 py-2">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {visibleCrossRefRows.length ? (
                    visibleCrossRefRows.map((row) => <CrossRefRow key={row.designator} row={row} />)
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-3 py-8 text-center text-sm text-emerald-700">
                        BOM과 좌표가 모두 일치합니다.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </div>
    </ErpModal>
  )
}
