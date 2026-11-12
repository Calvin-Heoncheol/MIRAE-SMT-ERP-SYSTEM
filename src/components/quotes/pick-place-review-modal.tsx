'use client'

import { useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal } from '@/components/ui/erp-modal'
import type { SmtBoardForm, DipBoardForm } from '@/lib/quotes/form-state'
import { toNumericField } from '@/lib/quotes/form-state'
import {
  applyAltiumPickPlaceToDipBoardForm,
  applyAltiumPickPlaceToSmtBoardForm,
  applyPickPlaceManualOverrides,
  buildPickPlaceRowKey,
  type AltiumPickPlaceAnalysis,
  type PickPlaceClassifiedRow,
  type PickPlaceComponentCategory,
  type PickPlaceManualOverride,
  type PickPlaceQuoteFieldKey,
} from '@/lib/quotes/parse-altium-pick-place'
import { classifyPickPlaceRowsWithDigiKeyAction } from '@/lib/quotes/pick-place-digikey-actions'
import { classifyPickPlaceRowsAction } from '@/lib/quotes/pick-place-ai-actions'
import {
  crossReferenceBomPickPlace,
  enrichPickPlaceWithBom,
  suggestDipCountsFromBom,
} from '@/lib/quotes/cross-reference-bom-pick-place'
import { isPickPlaceBomUnpopulatedRow } from '@/lib/quotes/bom-dnp'
import type { AltiumBomAnalysis } from '@/lib/quotes/parse-altium-bom'
import {
  countBlockingPickPlaceReviews,
  countDuplicateOnlyPickPlaceReviews,
  isPickPlaceDigiKeyEligible,
  rowMatchesPickPlaceReviewFilter,
  summarizePickPlaceReviewReasons,
  type PickPlaceReviewReasonTag,
} from '@/lib/quotes/pick-place-review-reasons'
import { QuoteFieldCard } from '@/components/quotes/pick-place-review-parts'
import {
  ReviewRow,
  toAiRowInput,
  toDigiKeyRowInput,
  toManualOverrideFromAi,
  toManualOverrideFromDigiKey,
} from '@/components/quotes/pick-place-review-row'

type PickPlaceReviewModalProps = {
  open: boolean
  analysis: AltiumPickPlaceAnalysis | null
  bomAnalysis?: AltiumBomAnalysis | null
  boardIndex?: number
  smtForms: SmtBoardForm[]
  dipForms?: DipBoardForm[]
  productName: string
  onClose: () => void
  onApply: (input: {
    smtForms: SmtBoardForm[]
    dipForms?: DipBoardForm[]
    productName?: string
    analysis: AltiumPickPlaceAnalysis
  }) => void
}

const SMD_COUNT_CATEGORIES = new Set<PickPlaceComponentCategory>(['chip', 'ic', 'bga', 'odd', 'special'])

const QUOTE_FIELD_CATEGORY: Partial<Record<PickPlaceQuoteFieldKey, PickPlaceComponentCategory>> = {
  chip: 'chip',
  icPin: 'ic',
  bga: 'bga',
  smtOdd: 'odd',
  smtSpecial: 'special',
  dipGeneral: 'dip_general',
  dipConnector: 'dip_connector',
  dipWire: 'dip_wire',
  dipXLarge: 'dip_xlarge',
}

function isFilterableQuoteField(key: PickPlaceQuoteFieldKey) {
  return key === 'smtTopCount' || key === 'smtBotCount' || key in QUOTE_FIELD_CATEGORY
}

function rowMatchesQuoteField(row: PickPlaceClassifiedRow, key: PickPlaceQuoteFieldKey) {
  if (key === 'smtTopCount') return row.side === 'top' && SMD_COUNT_CATEGORIES.has(row.category)
  if (key === 'smtBotCount') return row.side === 'bottom' && SMD_COUNT_CATEGORIES.has(row.category)
  const category = QUOTE_FIELD_CATEGORY[key]
  return category ? row.category === category : true
}

function PickPlaceReviewContent({
  analysis,
  bomAnalysis = null,
  showAllRows,
  reasonFilter,
  onReasonFilterChange,
  onToggleRows,
  editingRowKey,
  onStartEdit,
  onConfirmOverride,
  onCancelEdit,
  onBulkAiReview,
  bulkReviewLoading,
  bulkReviewPhase,
  bulkReviewError,
  bulkReviewSuccess,
  digiKeyEligibleCount,
}: {
  analysis: AltiumPickPlaceAnalysis
  showAllRows: boolean
  reasonFilter: PickPlaceReviewReasonTag | 'digikey_eligible' | null
  onReasonFilterChange: (filter: PickPlaceReviewReasonTag | 'digikey_eligible' | null) => void
  onToggleRows: () => void
  editingRowKey: string | null
  onStartEdit: (rowKey: string) => void
  onConfirmOverride: (rowKey: string, override: PickPlaceManualOverride) => void
  onCancelEdit: () => void
  onBulkAiReview: () => void
  bulkReviewLoading: boolean
  bulkReviewPhase: 'digikey' | 'ai' | null
  bulkReviewError: string | null
  bulkReviewSuccess: string | null
  digiKeyEligibleCount: number
  bomAnalysis?: AltiumBomAnalysis | null
}) {
  const bomCrossRef = useMemo(() => {
    if (!bomAnalysis) return null
    return crossReferenceBomPickPlace(bomAnalysis, analysis)
  }, [analysis, bomAnalysis])

  const bomUnpopulatedCount = useMemo(
    () => analysis.classifiedRows.filter(isPickPlaceBomUnpopulatedRow).length,
    [analysis.classifiedRows],
  )

  const bomUnpopulatedMismatch = useMemo(() => {
    if (!bomAnalysis || bomAnalysis.summary.excludedDesignatorCount <= 0) return null
    if (bomUnpopulatedCount > 0) return null
    return `BOM에 미실장 ${bomAnalysis.summary.excludedDesignatorCount}건이 있으나, 좌표 Designator와 일치하는 항목이 없습니다.`
  }, [bomAnalysis, bomUnpopulatedCount])

  const reasonSummary = useMemo(
    () => summarizePickPlaceReviewReasons(analysis.classifiedRows),
    [analysis.classifiedRows],
  )

  const [fieldFilter, setFieldFilter] = useState<PickPlaceQuoteFieldKey | null>(null)
  const fieldFilterLabel = fieldFilter
    ? analysis.quoteFields.find((field) => field.key === fieldFilter)?.label ?? null
    : null

  const visibleRows = useMemo(() => {
    const indexed = analysis.classifiedRows.map((row, index) => ({
      row,
      rowKey: buildPickPlaceRowKey(row, index),
    }))

    const bomUnpopulated = indexed.filter(({ row }) => isPickPlaceBomUnpopulatedRow(row))
    const active = indexed.filter(({ row }) => row.category !== 'skip')

    let rows = fieldFilter
      ? active.filter(({ row }) => rowMatchesQuoteField(row, fieldFilter))
      : showAllRows
        ? [...active, ...bomUnpopulated]
        : active.filter(({ row }) => row.confidence === 'ambiguous')

    if (reasonFilter) {
      rows = rows.filter(({ row }) => rowMatchesPickPlaceReviewFilter(row, reasonFilter))
    }

    if (reasonFilter === 'digikey_eligible') {
      rows = [...rows].sort((a, b) => Number(isPickPlaceDigiKeyEligible(b.row)) - Number(isPickPlaceDigiKeyEligible(a.row)))
    }

    return rows
  }, [analysis.classifiedRows, showAllRows, reasonFilter, fieldFilter])

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
          초록 — 확인됨
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
          주황 — 검토 필요 (클릭하여 분류)
        </span>
        {bomUnpopulatedCount > 0 ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-slate-400" />
            회색 — BOM 미실장
          </span>
        ) : null}
        <span className="text-slate-500">
          확인 {analysis.certainCount}건 · 검토 {analysis.ambiguousCount}건 · 제외 {analysis.skippedCount}건
          {bomUnpopulatedCount > 0 ? ` · 미실장 ${bomUnpopulatedCount}` : ''}
        </span>
        {bomCrossRef && bomAnalysis ? (
          <span
            className={
              bomCrossRef.matchedCount === 0 && bomAnalysis.summary.designatorCount > 0
                ? 'text-amber-700'
                : 'text-violet-700'
            }
          >
            BOM {bomAnalysis.summary.designatorCount}개 위치 · 매칭 {bomCrossRef.matchedCount}건
            {bomCrossRef.matchedCount === 0 && bomAnalysis.summary.designatorCount > 0
              ? ' (부품위치 컬럼 확인)'
              : ''}
          </span>
        ) : null}
      </div>

      {bomUnpopulatedMismatch ? (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
          {bomUnpopulatedMismatch}
        </p>
      ) : null}

      {reasonSummary.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-amber-100 bg-amber-50/50 px-3 py-2">
          <span className="text-[11px] font-semibold text-amber-900">검토 사유:</span>
          <button
            type="button"
            onClick={() => onReasonFilterChange(null)}
            className={[
              'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
              reasonFilter === null
                ? 'bg-amber-200 text-amber-950 ring-amber-300'
                : 'bg-white text-amber-800 ring-amber-200 hover:bg-amber-100',
            ].join(' ')}
          >
            전체 {analysis.ambiguousCount}
          </button>
          {reasonSummary.map(({ tag, count, label }) => (
            <button
              key={tag}
              type="button"
              onClick={() => onReasonFilterChange(reasonFilter === tag ? null : tag)}
              className={[
                'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                reasonFilter === tag
                  ? 'bg-amber-200 text-amber-950 ring-amber-300'
                  : 'bg-white text-amber-800 ring-amber-200 hover:bg-amber-100',
              ].join(' ')}
            >
              {label} {count}
            </button>
          ))}
          {digiKeyEligibleCount > 0 ? (
            <button
              type="button"
              onClick={() =>
                onReasonFilterChange(reasonFilter === 'digikey_eligible' ? null : 'digikey_eligible')
              }
              className={[
                'rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
                reasonFilter === 'digikey_eligible'
                  ? 'bg-red-200 text-red-950 ring-red-300'
                  : 'bg-white text-red-800 ring-red-200 hover:bg-red-50',
              ].join(' ')}
            >
              DigiKey 가능 {digiKeyEligibleCount}
            </button>
          ) : null}
        </div>
      ) : null}

      {bomCrossRef && bomAnalysis && bomCrossRef.bomOnlyCount > 0 ? (
        <p className="rounded-lg border border-violet-200 bg-violet-50/60 px-3 py-2 text-xs text-violet-900">
          BOM에만 있는 부품 {bomCrossRef.bomOnlyCount}건 — 수삽 후보는 견적 적용 시 DIP에 자동 반영됩니다.
        </p>
      ) : null}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-900">
              부품 분류 {fieldFilterLabel ? fieldFilterLabel : showAllRows ? '전체' : '검토 필요'}
            </h3>
            {fieldFilterLabel ? (
              <button
                type="button"
                onClick={() => setFieldFilter(null)}
                className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-semibold text-sky-800 ring-1 ring-inset ring-sky-200 hover:bg-sky-200"
                title="필터 해제"
              >
                필터: {fieldFilterLabel} {visibleRows.length}건 ✕
              </button>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {analysis.ambiguousCount > 0 ? (
              <button
                type="button"
                onClick={onBulkAiReview}
                disabled={bulkReviewLoading}
                className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkReviewLoading
                  ? bulkReviewPhase === 'digikey'
                    ? 'DigiKey 조회 중…'
                    : 'AI 검토 중…'
                  : `AI 일괄 검토 (${analysis.ambiguousCount}건)`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => {
                setFieldFilter(null)
                onToggleRows()
              }}
              className="text-xs font-medium text-sky-700 hover:text-sky-900"
            >
              {showAllRows ? '검토 필요만 보기' : `전체 보기 (${analysis.certainCount + analysis.ambiguousCount}건)`}
            </button>
          </div>
        </div>
        {bulkReviewError ? <p className="mb-2 text-[11px] text-red-600">{bulkReviewError}</p> : null}
        {bulkReviewSuccess ? (
          <div className="mb-2 rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-[11px] text-violet-900">
            {bulkReviewSuccess}
          </div>
        ) : null}
        <div className="max-h-[min(68vh,640px)] min-h-[240px] overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="px-2 py-2">Designator</th>
                <th className="px-2 py-2">분류</th>
                <th className="px-2 py-2 text-center">공정</th>
                <th className="px-2 py-2">면</th>
                <th className="px-2 py-2">Package</th>
                <th className="px-2 py-2">MPN</th>
                <th className="px-2 py-2">Value</th>
                <th className="px-2 py-2">판단 근거</th>
                <th className="px-2 py-2 text-center">신뢰도</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibleRows.length ? (
                visibleRows.map(({ row, rowKey }) => (
                  <ReviewRow
                    key={rowKey}
                    row={row}
                    isEditing={editingRowKey === rowKey}
                    onStartEdit={() => onStartEdit(rowKey)}
                    onConfirm={(override) => onConfirmOverride(rowKey, override)}
                    onCancel={onCancelEdit}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-3 py-8 text-center text-sm text-emerald-700">
                    {fieldFilterLabel
                      ? `${fieldFilterLabel}에 해당하는 부품이 없습니다.`
                      : '검토가 필요한 항목이 없습니다. 견적에 적용해도 됩니다.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-2.5 lg:w-44 xl:w-48">
        <div className="space-y-1.5">
          <p className="px-0.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            견적 반영값
          </p>
          {analysis.quoteFields.map((field) => (
            <QuoteFieldCard
              key={field.key}
              label={field.label}
              value={field.displayValue}
              confidence={field.confidence}
              note={field.note}
              compact
              active={fieldFilter === field.key}
              onClick={
                isFilterableQuoteField(field.key)
                  ? () => setFieldFilter((current) => (current === field.key ? null : field.key))
                  : undefined
              }
            />
          ))}
        </div>

        {analysis.summary.warnings.length ? (
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-2 text-[11px] leading-snug text-amber-900">
            {analysis.summary.warnings.map((warning, index) => (
              <li key={`${index}-${warning}`}>· {warning}</li>
            ))}
          </ul>
        ) : null}
      </aside>
      </div>
    </div>
  )
}

const analysisKeys = new WeakMap<object, number>()
let nextAnalysisKey = 0

function analysisKey(value: object) {
  let key = analysisKeys.get(value)
  if (key == null) {
    key = ++nextAnalysisKey
    analysisKeys.set(value, key)
  }
  return key
}

export function PickPlaceReviewModal(props: PickPlaceReviewModalProps) {
  const { open, analysis, bomAnalysis = null } = props
  const mergedAnalysis = useMemo(() => {
    if (!analysis) return null
    return bomAnalysis ? enrichPickPlaceWithBom(analysis, bomAnalysis) : analysis
  }, [analysis, bomAnalysis])

  if (!open || !mergedAnalysis) return null
  // 분석 결과가 바뀌면 검토 상태(수동 분류·필터 등)를 새로 시작
  return (
    <PickPlaceReviewModalContent
      key={analysisKey(mergedAnalysis)}
      {...props}
      baseAnalysis={mergedAnalysis}
    />
  )
}

function PickPlaceReviewModalContent({
  baseAnalysis,
  bomAnalysis = null,
  boardIndex = 0,
  smtForms,
  dipForms = [],
  productName,
  onClose,
  onApply,
}: PickPlaceReviewModalProps & { baseAnalysis: AltiumPickPlaceAnalysis }) {
  const [showAllRows, setShowAllRows] = useState(false)
  const [localAnalysis, setLocalAnalysis] = useState<AltiumPickPlaceAnalysis>(baseAnalysis)
  const [manualOverrides, setManualOverrides] = useState<Record<string, PickPlaceManualOverride>>({})
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null)
  const [bulkReviewLoading, setBulkReviewLoading] = useState(false)
  const [bulkReviewPhase, setBulkReviewPhase] = useState<'digikey' | 'ai' | null>(null)
  const [bulkReviewError, setBulkReviewError] = useState<string | null>(null)
  const [bulkReviewSuccess, setBulkReviewSuccess] = useState<string | null>(null)
  const [reasonFilter, setReasonFilter] = useState<PickPlaceReviewReasonTag | 'digikey_eligible' | null>(null)
  const [duplicateAcknowledged, setDuplicateAcknowledged] = useState(false)

  const resolvedBaseAnalysis = baseAnalysis
  const resolvedLocalAnalysis = localAnalysis

  const digiKeyEligibleCount = resolvedLocalAnalysis.classifiedRows.filter(isPickPlaceDigiKeyEligible).length

  const blockingCount = countBlockingPickPlaceReviews(resolvedLocalAnalysis.classifiedRows)
  const duplicateOnlyCount = countDuplicateOnlyPickPlaceReviews(resolvedLocalAnalysis.classifiedRows)
  const canApply =
    blockingCount === 0 && (duplicateOnlyCount === 0 || duplicateAcknowledged)

  async function handleBulkAiReview() {
    const ambiguousRows = resolvedBaseAnalysis.classifiedRows
      .map((row, index) => ({ row, index, rowKey: buildPickPlaceRowKey(row, index) }))
      .filter(({ row, rowKey }) => {
        if (row.category === 'skip') return false
        if (manualOverrides[rowKey]) return false
        return row.confidence === 'ambiguous'
      })
    if (!ambiguousRows.length) return

    setBulkReviewLoading(true)
    setBulkReviewPhase(null)
    setBulkReviewError(null)
    setBulkReviewSuccess(null)

    const nextOverrides = { ...manualOverrides }
    let digiKeyCount = 0
    let aiCount = 0
    const notes: string[] = []

    try {
      const digiKeyTargets = ambiguousRows.filter(({ row }) => isPickPlaceDigiKeyEligible(row))
      if (digiKeyTargets.length) {
        setBulkReviewPhase('digikey')
        const digiKeyResult = await classifyPickPlaceRowsWithDigiKeyAction({
          rows: digiKeyTargets.map(({ row }) => toDigiKeyRowInput(row)),
        })
        if (digiKeyResult.ok) {
          const byDesignator = new Map(
            digiKeyResult.classifications.map((classification) => [
              classification.designator.toUpperCase(),
              classification,
            ]),
          )
          for (const { row, rowKey } of digiKeyTargets) {
            const classification = byDesignator.get(row.designator.toUpperCase())
            if (!classification) continue
            nextOverrides[rowKey] = toManualOverrideFromDigiKey(classification)
            digiKeyCount += 1
          }
          if (digiKeyResult.skipped.length) {
            notes.push(
              `DigiKey 미확인 ${digiKeyResult.skipped.length}건 → AI로 이관`,
            )
          }
        } else {
          notes.push(`DigiKey 생략: ${digiKeyResult.detail}`)
        }
      }

      const remainingForAi = ambiguousRows.filter(({ rowKey }) => !nextOverrides[rowKey])
      if (remainingForAi.length) {
        setBulkReviewPhase('ai')
        const aiResult = await classifyPickPlaceRowsAction({
          rows: remainingForAi.map(({ row }) => toAiRowInput(row)),
        })
        if (!aiResult.ok) throw new Error(aiResult.detail)

        const byDesignator = new Map(
          aiResult.classifications.map((classification) => [
            classification.designator.toUpperCase(),
            classification,
          ]),
        )
        for (const { row, rowKey } of remainingForAi) {
          const classification = byDesignator.get(row.designator.toUpperCase())
          if (!classification) continue
          nextOverrides[rowKey] = toManualOverrideFromAi(classification)
          aiCount += 1
        }
      }

      setManualOverrides(nextOverrides)
      setLocalAnalysis(applyPickPlaceManualOverrides(resolvedBaseAnalysis, nextOverrides))
      setEditingRowKey(null)

      const summaryParts = [
        digiKeyCount > 0 ? `DigiKey ${digiKeyCount}건` : null,
        aiCount > 0 ? `AI ${aiCount}건` : null,
      ].filter(Boolean)
      const summary =
        summaryParts.length > 0
          ? `일괄 검토 완료 — ${summaryParts.join(' · ')}${notes.length ? ` (${notes.join(', ')})` : ''}`
          : notes.length
            ? notes.join(' · ')
            : '일괄 검토 결과가 없습니다.'
      setBulkReviewSuccess(summary)
    } catch (caught) {
      setBulkReviewError(
        caught instanceof Error ? caught.message : 'AI 일괄 검토 중 오류가 발생했습니다.',
      )
    } finally {
      setBulkReviewLoading(false)
      setBulkReviewPhase(null)
    }
  }

  function handleConfirmOverride(rowKey: string, override: PickPlaceManualOverride) {
    const nextOverrides = {
      ...manualOverrides,
      [rowKey]: override,
    }
    setManualOverrides(nextOverrides)
    setLocalAnalysis(applyPickPlaceManualOverrides(resolvedBaseAnalysis, nextOverrides))
    setEditingRowKey(null)
  }

  function handleApply() {
    const target = smtForms[boardIndex]
    if (!target) return
    const nextBoard = applyAltiumPickPlaceToSmtBoardForm(target, resolvedLocalAnalysis.summary)
    const nextForms = smtForms.map((board, index) => (index === boardIndex ? nextBoard : board))
    const dipTarget = dipForms[boardIndex]
    let nextDipForms: DipBoardForm[] | undefined

    if (dipTarget) {
      nextDipForms = dipForms.map((board, index) => {
        if (index !== boardIndex) return board
        let merged = applyAltiumPickPlaceToDipBoardForm(board, resolvedLocalAnalysis.summary)
        if (bomAnalysis) {
          const crossRef = crossReferenceBomPickPlace(bomAnalysis, resolvedLocalAnalysis)
          const bomDip = suggestDipCountsFromBom(bomAnalysis, crossRef)
          merged = {
            ...merged,
            dipGeneral: toNumericField((Number(merged.dipGeneral) || 0) + bomDip.dipGeneral),
            dipConnector: toNumericField((Number(merged.dipConnector) || 0) + bomDip.dipConnector),
          }
        }
        return merged
      })
    }

    onApply({
      smtForms: nextForms,
      dipForms: nextDipForms,
      productName: productName.trim() || resolvedLocalAnalysis.summary.pcbName,
      analysis: resolvedLocalAnalysis,
    })
  }

  return (
    <ErpModal
      open
      size="wide"
      title="Pick&Place 분석 결과"
      description={`${resolvedLocalAnalysis.fileName} · 분석 결과 검토`}
      onClose={onClose}
      zIndexClassName="z-[60]"
      contentClassName="px-5 py-4"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            {blockingCount > 0 ? (
              <p className="text-xs text-amber-700">
                검토 필요 {blockingCount}건 — 뱃지를 눌러 분류하거나 AI 일괄 검토를 사용하세요.
              </p>
            ) : duplicateOnlyCount > 0 && !duplicateAcknowledged ? (
              <label className="flex cursor-pointer items-start gap-2 text-xs text-amber-800">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={duplicateAcknowledged}
                  onChange={(event) => setDuplicateAcknowledged(event.target.checked)}
                />
                <span>
                  Designator 중복 {duplicateOnlyCount}건을 확인했습니다. (데이터 오류 가능 — 적용 시 주의)
                </span>
              </label>
            ) : (
              <p className="text-xs text-emerald-700">모든 항목이 확인되었습니다.</p>
            )}
          </div>
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={onClose}>
              취소
            </ErpButton>
            <ErpButton onClick={handleApply} disabled={!canApply}>
              견적서에 적용
            </ErpButton>
          </div>
        </div>
      }
    >
      <PickPlaceReviewContent
        analysis={localAnalysis}
        bomAnalysis={bomAnalysis}
        showAllRows={showAllRows}
        reasonFilter={reasonFilter}
        onReasonFilterChange={setReasonFilter}
        onToggleRows={() => setShowAllRows((current) => !current)}
        editingRowKey={editingRowKey}
        onStartEdit={setEditingRowKey}
        onConfirmOverride={handleConfirmOverride}
        onCancelEdit={() => setEditingRowKey(null)}
        onBulkAiReview={() => void handleBulkAiReview()}
        bulkReviewLoading={bulkReviewLoading}
        bulkReviewPhase={bulkReviewPhase}
        bulkReviewError={bulkReviewError}
        bulkReviewSuccess={bulkReviewSuccess}
        digiKeyEligibleCount={digiKeyEligibleCount}
      />
    </ErpModal>
  )
}
