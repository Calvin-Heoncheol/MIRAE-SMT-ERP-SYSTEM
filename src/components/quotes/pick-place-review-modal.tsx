'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { ErpButton } from '@/components/ui/erp-button'
import { ErpModal, useErpModalRequestClose } from '@/components/ui/erp-modal'
import type { SmtBoardForm } from '@/lib/quotes/form-state'
import { formatPickPlaceSideLabel } from '@/lib/quotes/canonical-pick-place'
import {
  applyAltiumPickPlaceToDipBoardForm,
  applyAltiumPickPlaceToSmtBoardForm,
  applyPickPlaceManualOverrides,
  buildPickPlaceRowKey,
  PICK_PLACE_CONFIDENCE_STYLES,
  PICK_PLACE_DIP_CATEGORY_OPTIONS,
  PICK_PLACE_SMD_CATEGORY_OPTIONS,
  pickPlaceConfidenceLabel,
  suggestBgaBallCountForRow,
  suggestIcPinCountForRow,
  suggestPickPlaceDipCategory,
  suggestPickPlaceMountType,
  type AltiumPickPlaceAnalysis,
  type PickPlaceClassifiedRow,
  type PickPlaceComponentCategory,
  type PickPlaceConfidence,
  type PickPlaceManualOverride,
  type PickPlaceMountType,
  type PickPlaceReviewSource,
} from '@/lib/quotes/parse-altium-pick-place'
import type { DipBoardForm } from '@/lib/quotes/form-state'
import { classifyPickPlaceRowsWithDigiKeyAction } from '@/lib/quotes/pick-place-digikey-actions'
import type { PickPlaceDigiKeyClassification } from '@/lib/quotes/digikey-types'
import { classifyPickPlaceRowsAction } from '@/lib/quotes/pick-place-ai-actions'
import type { PickPlaceAiClassification } from '@/lib/quotes/pick-place-ai-types'
import { isPickPlaceDipCategory } from '@/lib/quotes/pick-place-mount-categories'
import { crossReferenceBomPickPlace, enrichPickPlaceWithBom } from '@/lib/quotes/cross-reference-bom-pick-place'
import {
  bomUnpopulatedBadgeHint,
  isPickPlaceBomUnpopulatedRow,
} from '@/lib/quotes/bom-dnp'
import type { AltiumBomAnalysis } from '@/lib/quotes/parse-altium-bom'

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

function BomUnpopulatedBadge({
  reason,
  detail,
  value,
}: {
  reason?: import('@/lib/quotes/bom-dnp').BomExcludeReason
  detail?: string
  value?: string
}) {
  const hint = bomUnpopulatedBadgeHint(reason, {
    comment: value || '',
    description: value || '',
  })
  return (
    <span
      className="inline-flex flex-col items-center gap-0.5"
      title={detail || 'BOM 미실장'}
    >
      <span className="inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
        미실장
      </span>
      {hint ? <span className="text-[8px] font-medium text-slate-500">{hint}</span> : null}
    </span>
  )
}

function ReviewSourceBadge({ source }: { source?: PickPlaceReviewSource }) {
  if (!source) return null

  const styles =
    source === 'digikey'
      ? 'bg-red-100 text-red-800 ring-red-200'
      : source === 'ai'
        ? 'bg-violet-100 text-violet-800 ring-violet-200'
        : 'bg-slate-100 text-slate-700 ring-slate-200'

  const label = source === 'digikey' ? 'DigiKey' : source === 'ai' ? 'AI' : '수동'

  return (
    <span
      className={[
        'inline-flex rounded-full px-1.5 py-0.5 text-[9px] font-semibold ring-1 ring-inset',
        styles,
      ].join(' ')}
    >
      {label}
    </span>
  )
}
function ConfidenceBadge({
  confidence,
  interactive = false,
  onClick,
}: {
  confidence: PickPlaceConfidence
  interactive?: boolean
  onClick?: () => void
}) {
  const className = [
    'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
    PICK_PLACE_CONFIDENCE_STYLES[confidence].badge,
    interactive ? 'cursor-pointer hover:ring-2' : '',
  ].join(' ')

  if (interactive && onClick) {
    return (
      <button type="button" onClick={onClick} className={className} title="클릭하여 분류 선택">
        {pickPlaceConfidenceLabel(confidence)}
      </button>
    )
  }

  return <span className={className}>{pickPlaceConfidenceLabel(confidence)}</span>
}

function ConfidenceDot({ confidence }: { confidence: PickPlaceConfidence }) {
  return (
    <span
      className={[
        'inline-block h-2 w-2 shrink-0 rounded-full',
        confidence === 'certain' ? 'bg-emerald-500' : 'bg-amber-500',
      ].join(' ')}
      title={pickPlaceConfidenceLabel(confidence)}
    />
  )
}

function QuoteFieldCard({
  label,
  value,
  confidence,
  note,
  compact = false,
}: {
  label: string
  value: string
  confidence: PickPlaceConfidence
  note?: string
  compact?: boolean
}) {
  if (compact) {
    return (
      <div
        className={[
          'rounded-md border px-2 py-1.5',
          PICK_PLACE_CONFIDENCE_STYLES[confidence].card,
        ].join(' ')}
      >
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-[10px] font-medium leading-tight text-slate-600">{label}</p>
          <ConfidenceDot confidence={confidence} />
        </div>
        <p className="mt-0.5 text-xs font-semibold tabular-nums leading-tight text-slate-900">{value}</p>
        {note ? <p className="mt-0.5 truncate text-[9px] text-slate-500" title={note}>{note}</p> : null}
      </div>
    )
  }

  return (
    <div
      className={[
        'rounded-lg border px-3 py-2.5',
        PICK_PLACE_CONFIDENCE_STYLES[confidence].card,
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium text-slate-600">{label}</p>
        <ConfidenceBadge confidence={confidence} />
      </div>
      <p className="mt-1 text-sm font-semibold tabular-nums text-slate-900">{value}</p>
      {note ? <p className="mt-1 text-[10px] text-slate-500">{note}</p> : null}
    </div>
  )
}

function toAiRowInput(row: PickPlaceClassifiedRow) {
  return {
    designator: row.designator,
    side: row.side,
    package: row.package,
    value: row.value,
    description: row.description,
    currentCategory: row.category,
    currentDetail: row.detail,
  }
}

function toManualOverrideFromAi(classification: PickPlaceAiClassification): PickPlaceManualOverride {
  const override: PickPlaceManualOverride = {
    category: classification.category,
    source: 'ai',
    aiReason: classification.reason,
  }
  if (classification.icPinCount) override.icPinCount = classification.icPinCount
  if (classification.bgaBallCount) override.bgaBallCount = classification.bgaBallCount
  return override
}

function toDigiKeyRowInput(row: PickPlaceClassifiedRow) {
  return {
    designator: row.designator,
    mpn: row.mpn,
    package: row.package,
    value: row.value,
    description: row.description,
    currentCategory: row.category,
  }
}

function toManualOverrideFromDigiKey(
  classification: PickPlaceDigiKeyClassification,
): PickPlaceManualOverride {
  const override: PickPlaceManualOverride = {
    category: classification.category,
    source: 'digikey',
    aiReason: classification.reason,
  }
  if (classification.icPinCount) override.icPinCount = classification.icPinCount
  if (classification.bgaBallCount) override.bgaBallCount = classification.bgaBallCount
  return override
}

function ManualReviewPanel({
  row,
  onConfirm,
  onCancel,
}: {
  row: PickPlaceClassifiedRow
  onConfirm: (override: PickPlaceManualOverride) => void
  onCancel: () => void
}) {
  const initialMountType = suggestPickPlaceMountType(row)
  const initialCategory: PickPlaceComponentCategory = isPickPlaceDipCategory(row.category)
    ? row.category
    : initialMountType === 'dip'
      ? suggestPickPlaceDipCategory(row)
      : row.category === 'skip' || row.category === 'chip' || row.category === 'ic' || row.category === 'bga' || row.category === 'odd' || row.category === 'special'
        ? row.category
        : 'chip'

  const [mountType, setMountType] = useState<PickPlaceMountType | null>(() =>
    isPickPlaceDipCategory(row.category) || initialMountType === 'dip' ? 'dip' : null,
  )
  const [category, setCategory] = useState<PickPlaceComponentCategory>(initialCategory)
  const [icPinCount, setIcPinCount] = useState(String(suggestIcPinCountForRow(row) || ''))
  const [bgaBallCount, setBgaBallCount] = useState(String(suggestBgaBallCountForRow(row) || ''))
  const [aiLoading, setAiLoading] = useState(false)
  const [digiKeyLoading, setDigiKeyLoading] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [aiReason, setAiReason] = useState<string | null>(null)
  const [suggestionSource, setSuggestionSource] = useState<'ai' | 'digikey' | null>(null)

  const smdOptions = PICK_PLACE_SMD_CATEGORY_OPTIONS
  const dipHandOptions = PICK_PLACE_DIP_CATEGORY_OPTIONS.filter((option) => option.group === 'hand')
  const dipWaveOptions = PICK_PLACE_DIP_CATEGORY_OPTIONS.filter((option) => option.group === 'wave')
  const selectedSmdOption = smdOptions.find((item) => item.category === category)
  const selectedDipOption = PICK_PLACE_DIP_CATEGORY_OPTIONS.find((item) => item.category === category)

  function selectMountType(next: PickPlaceMountType) {
    setMountType(next)
    if (next === 'dip') {
      setCategory(suggestPickPlaceDipCategory(row))
      return
    }
    if (row.category === 'skip' || row.category === 'chip' || row.category === 'ic' || row.category === 'bga' || row.category === 'odd' || row.category === 'special') {
      setCategory(row.category)
      return
    }
    setCategory('chip')
  }

  function confirmCategory(nextCategory: PickPlaceComponentCategory) {
    const override: PickPlaceManualOverride = {
      category: nextCategory,
      source: suggestionSource ?? 'manual',
      aiReason: aiReason ?? undefined,
    }
    if (nextCategory === 'ic') {
      const parsed = Number(icPinCount)
      if (Number.isFinite(parsed) && parsed > 0) override.icPinCount = Math.floor(parsed)
    }
    if (nextCategory === 'bga') {
      const parsed = Number(bgaBallCount)
      if (Number.isFinite(parsed) && parsed > 0) override.bgaBallCount = Math.floor(parsed)
    }
    onConfirm(override)
  }

  async function handleDigiKeyReview() {
    if (!row.mpn.trim()) return
    setDigiKeyLoading(true)
    setAiError(null)
    try {
      const result = await classifyPickPlaceRowsWithDigiKeyAction({ rows: [toDigiKeyRowInput(row)] })
      if (!result.ok) throw new Error(result.detail)
      const suggestion = result.classifications[0]
      if (!suggestion) throw new Error('DigiKey 조회 결과를 받지 못했습니다.')

      setCategory(suggestion.category)
      setMountType('smd')
      setAiReason(suggestion.reason)
      setSuggestionSource('digikey')
      if (suggestion.icPinCount) setIcPinCount(String(suggestion.icPinCount))
      if (suggestion.bgaBallCount) setBgaBallCount(String(suggestion.bgaBallCount))
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : 'DigiKey 조회 중 오류가 발생했습니다.')
    } finally {
      setDigiKeyLoading(false)
    }
  }

  async function handleAiReview() {
    setAiLoading(true)
    setAiError(null)
    try {
      const result = await classifyPickPlaceRowsAction({ rows: [toAiRowInput(row)] })
      if (!result.ok) throw new Error(result.detail)
      const suggestion = result.classifications[0]
      if (!suggestion) throw new Error('AI 분류 결과를 받지 못했습니다.')

      setCategory(suggestion.category)
      setMountType('smd')
      setAiReason(suggestion.reason)
      setSuggestionSource('ai')
      if (suggestion.icPinCount) setIcPinCount(String(suggestion.icPinCount))
      if (suggestion.bgaBallCount) setBgaBallCount(String(suggestion.bgaBallCount))
    } catch (caught) {
      setAiError(caught instanceof Error ? caught.message : 'AI 검토 중 오류가 발생했습니다.')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="rounded-lg border border-amber-200 bg-white px-3 py-3 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-900">
            {row.designator} — 분류를 선택해 주세요
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {[row.package, row.value].filter(Boolean).join(' · ') || row.description || 'Package 정보 없음'}
            {row.mpn ? ` · MPN ${row.mpn}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {row.mpn.trim() ? (
            <button
              type="button"
              onClick={() => void handleDigiKeyReview()}
              disabled={digiKeyLoading || aiLoading}
              className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1.5 text-[11px] font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {digiKeyLoading ? 'DigiKey 조회 중…' : 'DigiKey 조회'}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void handleAiReview()}
            disabled={aiLoading || digiKeyLoading}
            className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1.5 text-[11px] font-semibold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {aiLoading ? 'AI 검토 중…' : 'AI 검토'}
          </button>
        </div>
      </div>
      {aiError ? <p className="mt-2 text-[11px] text-red-600">{aiError}</p> : null}
      {aiReason ? (
        <p className="mt-2 rounded-md border border-sky-200 bg-sky-50/70 px-2.5 py-2 text-[11px] text-sky-900">
          제안: {aiReason}
        </p>
      ) : null}

      {!mountType ? (
        <div className="mt-3 space-y-3">
          <p className="text-[11px] font-medium text-slate-700">실장 방식을 먼저 선택하세요.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => selectMountType('smd')}
              className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-4 text-left hover:border-sky-300"
            >
              <p className="text-sm font-semibold text-sky-900">SMD</p>
              <p className="mt-1 text-[11px] text-sky-800/80">Chip · IC · BGA · 이형 · 특수/커넥터</p>
            </button>
            <button
              type="button"
              onClick={() => selectMountType('dip')}
              className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-4 text-left hover:border-amber-300"
            >
              <p className="text-sm font-semibold text-amber-950">DIP / 후공정 납땜</p>
              <p className="mt-1 text-[11px] text-amber-900/80">수납땜 · WAVE 소/중/대형</p>
            </button>
          </div>
          <button
            type="button"
            onClick={() => confirmCategory('skip')}
            className="text-[11px] font-medium text-slate-500 underline-offset-2 hover:text-slate-700 hover:underline"
          >
            이 항목 제외
          </button>
        </div>
      ) : mountType === 'smd' ? (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-sky-900">SMD 분류</p>
            <button
              type="button"
              onClick={() => setMountType(null)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
            >
              ← 방식 다시 선택
            </button>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {smdOptions.map((option) => (
              <button
                key={option.category}
                type="button"
                onClick={() => setCategory(option.category)}
                className={[
                  'rounded-md border px-2.5 py-2 text-left text-xs transition',
                  category === option.category
                    ? 'border-sky-400 bg-sky-50 text-sky-900 ring-1 ring-sky-200'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300',
                ].join(' ')}
              >
                <span className="font-semibold">{option.label}</span>
                <span className="mt-0.5 block text-[10px] text-slate-500">{option.hint}</span>
              </button>
            ))}
          </div>
          {category === 'ic' ? (
            <label className="block text-xs text-slate-700">
              IC PIN 수
              <input
                type="number"
                min={1}
                value={icPinCount}
                onChange={(event) => setIcPinCount(event.target.value)}
                className="mt-1 w-full max-w-[160px] rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="예: 64"
              />
            </label>
          ) : null}
          {category === 'bga' ? (
            <label className="block text-xs text-slate-700">
              BGA BALL 수
              <input
                type="number"
                min={1}
                value={bgaBallCount}
                onChange={(event) => setBgaBallCount(event.target.value)}
                className="mt-1 w-full max-w-[160px] rounded-md border border-slate-200 px-2 py-1.5 text-sm"
                placeholder="예: 256"
              />
            </label>
          ) : null}
          {selectedSmdOption ? (
            <p className="text-[11px] text-slate-500">선택: {selectedSmdOption.hint}</p>
          ) : null}
        </div>
      ) : (
        <div className="mt-3 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-amber-950">후공정 납땜 분류</p>
            <button
              type="button"
              onClick={() => setMountType(null)}
              className="text-[11px] font-medium text-slate-500 hover:text-slate-700"
            >
              ← 방식 다시 선택
            </button>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">수납땜</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {dipHandOptions.map((option) => (
                <button
                  key={option.category}
                  type="button"
                  onClick={() => setCategory(option.category)}
                  className={[
                    'rounded-md border px-2.5 py-2 text-left text-xs transition',
                    category === option.category
                      ? 'border-amber-400 bg-amber-50 text-amber-950 ring-1 ring-amber-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className="font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">WAVE</p>
            <div className="grid gap-2 sm:grid-cols-3">
              {dipWaveOptions.map((option) => (
                <button
                  key={option.category}
                  type="button"
                  onClick={() => setCategory(option.category)}
                  className={[
                    'rounded-md border px-2.5 py-2 text-left text-xs transition',
                    category === option.category
                      ? 'border-violet-400 bg-violet-50 text-violet-950 ring-1 ring-violet-200'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300',
                  ].join(' ')}
                >
                  <span className="font-semibold">{option.label}</span>
                  <span className="mt-0.5 block text-[10px] text-slate-500">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>
          {selectedDipOption ? (
            <p className="text-[11px] text-slate-500">선택: {selectedDipOption.label} · {selectedDipOption.hint}</p>
          ) : null}
        </div>
      )}

      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
        >
          취소
        </button>
        {mountType ? (
          <button
            type="button"
            onClick={() => confirmCategory(category)}
            className="rounded-md bg-sky-700 px-3 py-1.5 text-xs font-semibold text-white hover:bg-sky-800"
          >
            확인
          </button>
        ) : null}
      </div>
    </div>
  )
}

function ReviewRow({
  row,
  isEditing,
  onStartEdit,
  onConfirm,
  onCancel,
}: {
  row: PickPlaceClassifiedRow
  isEditing: boolean
  onStartEdit: () => void
  onConfirm: (override: PickPlaceManualOverride) => void
  onCancel: () => void
}) {
  const bomUnpopulated = isPickPlaceBomUnpopulatedRow(row)
  const canEdit =
    !bomUnpopulated &&
    (row.confidence === 'ambiguous' || Boolean(row.reviewSource))

  return (
    <Fragment>
      <tr className={bomUnpopulated ? 'bg-slate-100/90' : PICK_PLACE_CONFIDENCE_STYLES[row.confidence].row}>
        <td
          className={[
            'whitespace-nowrap px-2 py-2 font-mono text-xs',
            bomUnpopulated ? 'text-slate-500 line-through' : 'text-slate-800',
          ].join(' ')}
        >
          {row.designator}
        </td>
        <td className="px-2 py-2 text-xs text-slate-700">
          <div className="flex flex-wrap items-center gap-1">
            <span className={bomUnpopulated ? 'text-slate-500' : undefined}>{row.categoryLabel}</span>
            {bomUnpopulated ? (
              <span className="inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-[9px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-300">
                미실장
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-2 py-2 text-xs text-slate-600">
          {formatPickPlaceSideLabel(row.side, row.rawLayer)}
        </td>
        <td className="max-w-[120px] truncate px-2 py-2 text-xs text-slate-600" title={row.package}>
          {row.package || '—'}
        </td>
        <td
          className={[
            'max-w-[140px] truncate px-2 py-2 font-mono text-xs',
            row.mpn.trim() ? 'text-slate-700' : 'text-slate-400',
          ].join(' ')}
          title={row.mpn || 'MPN 없음 — DigiKey 조회 불가'}
        >
          {row.mpn.trim() || '—'}
        </td>
        <td className="max-w-[120px] truncate px-2 py-2 text-xs text-slate-600" title={row.value}>
          {row.value || '—'}
        </td>
        <td className="max-w-[180px] truncate px-2 py-2 text-xs text-slate-600" title={row.detail}>
          {row.detail}
        </td>
        <td className="px-2 py-2 text-center">
          <div className="flex flex-col items-center gap-1">
            {bomUnpopulated ? (
              <BomUnpopulatedBadge reason={row.bomExcludeReason} detail={row.detail} value={row.value} />
            ) : (
              <>
                <ConfidenceBadge
                  confidence={row.confidence}
                  interactive={canEdit}
                  onClick={canEdit ? onStartEdit : undefined}
                />
                <ReviewSourceBadge source={row.reviewSource} />
              </>
            )}
          </div>
        </td>
      </tr>
      {isEditing ? (
        <tr className="bg-amber-50/40">
          <td colSpan={8} className="px-2 py-2">
            <ManualReviewPanel row={row} onConfirm={onConfirm} onCancel={onCancel} />
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
}

function PickPlaceReviewContent({
  analysis,
  bomAnalysis = null,
  showAllRows,
  onToggleRows,
  editingRowKey,
  onStartEdit,
  onConfirmOverride,
  onCancelEdit,
  onBulkAiReview,
  bulkAiLoading,
  bulkAiError,
  onBulkDigiKeyReview,
  bulkDigiKeyLoading,
  bulkDigiKeyError,
  bulkDigiKeySuccess,
  digiKeyEligibleCount,
}: {
  analysis: AltiumPickPlaceAnalysis
  showAllRows: boolean
  onToggleRows: () => void
  editingRowKey: string | null
  onStartEdit: (rowKey: string) => void
  onConfirmOverride: (rowKey: string, override: PickPlaceManualOverride) => void
  onCancelEdit: () => void
  onBulkAiReview: () => void
  bulkAiLoading: boolean
  bulkAiError: string | null
  onBulkDigiKeyReview: () => void
  bulkDigiKeyLoading: boolean
  bulkDigiKeyError: string | null
  bulkDigiKeySuccess: string[] | null
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

  const visibleRows = useMemo(() => {
    const indexed = analysis.classifiedRows.map((row, index) => ({
      row,
      rowKey: buildPickPlaceRowKey(row, index),
    }))

    const bomUnpopulated = indexed.filter(({ row }) => isPickPlaceBomUnpopulatedRow(row))
    const active = indexed.filter(({ row }) => row.category !== 'skip')

    if (showAllRows) return [...active, ...bomUnpopulated]
    return active.filter(({ row }) => row.confidence === 'ambiguous')
  }, [analysis.classifiedRows, showAllRows])

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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-stretch lg:gap-5">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">
            부품 분류 {showAllRows ? '전체' : '검토 필요'}
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            {analysis.ambiguousCount > 0 ? (
              <button
                type="button"
                onClick={onBulkAiReview}
                disabled={bulkAiLoading || bulkDigiKeyLoading}
                className="rounded-md border border-violet-300 bg-violet-50 px-2.5 py-1 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkAiLoading ? 'AI 일괄 검토 중…' : `AI 일괄 검토 (${analysis.ambiguousCount}건)`}
              </button>
            ) : null}
            {digiKeyEligibleCount > 0 ? (
              <button
                type="button"
                onClick={onBulkDigiKeyReview}
                disabled={bulkDigiKeyLoading || bulkAiLoading}
                className="rounded-md border border-red-300 bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-800 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {bulkDigiKeyLoading
                  ? 'DigiKey 조회 중…'
                  : `DigiKey 조회 (${digiKeyEligibleCount}건)`}
              </button>
            ) : null}
            <button
              type="button"
              onClick={onToggleRows}
              className="text-xs font-medium text-sky-700 hover:text-sky-900"
            >
              {showAllRows ? '검토 필요만 보기' : `전체 보기 (${analysis.certainCount + analysis.ambiguousCount}건)`}
            </button>
          </div>
        </div>
        {bulkAiError ? <p className="mb-2 text-[11px] text-red-600">{bulkAiError}</p> : null}
        {bulkDigiKeyError ? <p className="mb-2 text-[11px] text-red-600">{bulkDigiKeyError}</p> : null}
        {bulkDigiKeySuccess?.length ? (
          <div className="mb-2 rounded-lg border border-red-200 bg-red-50/80 px-3 py-2 text-[11px] text-red-900">
            <p className="font-semibold">DigiKey로 {bulkDigiKeySuccess.length}건 확인됨</p>
            <p className="mt-1 font-mono text-[10px] leading-relaxed text-red-800">
              {bulkDigiKeySuccess.join(', ')}
            </p>
          </div>
        ) : null}
        <div className="max-h-[min(68vh,640px)] min-h-[240px] overflow-auto rounded-lg border border-slate-200">
          <table className="min-w-full border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-slate-50 text-[11px] font-semibold text-slate-600">
              <tr>
                <th className="px-2 py-2">Designator</th>
                <th className="px-2 py-2">분류</th>
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
                  <td colSpan={8} className="px-3 py-8 text-center text-sm text-emerald-700">
                    검토가 필요한 항목이 없습니다. 견적에 적용해도 됩니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-2.5 lg:w-44 xl:w-48">
        <div className="space-y-1.5">
          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
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
            />
          ))}
        </div>

        {analysis.summary.warnings.length ? (
          <ul className="space-y-1 rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-2 text-[10px] leading-snug text-amber-900">
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

export function PickPlaceReviewModal({
  open,
  analysis,
  bomAnalysis = null,
  boardIndex = 0,
  smtForms,
  dipForms = [],
  productName,
  onClose,
  onApply,
}: PickPlaceReviewModalProps) {
  const requestClose = useErpModalRequestClose()
  const [showAllRows, setShowAllRows] = useState(false)
  const [baseAnalysis, setBaseAnalysis] = useState<AltiumPickPlaceAnalysis | null>(null)
  const [localAnalysis, setLocalAnalysis] = useState<AltiumPickPlaceAnalysis | null>(null)
  const [manualOverrides, setManualOverrides] = useState<Record<string, PickPlaceManualOverride>>({})
  const [editingRowKey, setEditingRowKey] = useState<string | null>(null)
  const [bulkAiLoading, setBulkAiLoading] = useState(false)
  const [bulkAiError, setBulkAiError] = useState<string | null>(null)
  const [bulkDigiKeyLoading, setBulkDigiKeyLoading] = useState(false)
  const [bulkDigiKeyError, setBulkDigiKeyError] = useState<string | null>(null)
  const [bulkDigiKeySuccess, setBulkDigiKeySuccess] = useState<string[] | null>(null)

  const mergedAnalysis = useMemo(() => {
    if (!analysis) return null
    return bomAnalysis ? enrichPickPlaceWithBom(analysis, bomAnalysis) : analysis
  }, [analysis, bomAnalysis])

  useEffect(() => {
    if (!open || !mergedAnalysis) return
    setShowAllRows(false)
    setBaseAnalysis(mergedAnalysis)
    setLocalAnalysis(mergedAnalysis)
    setManualOverrides({})
    setEditingRowKey(null)
    setBulkAiLoading(false)
    setBulkAiError(null)
    setBulkDigiKeyLoading(false)
    setBulkDigiKeyError(null)
    setBulkDigiKeySuccess(null)
  }, [open, mergedAnalysis])

  if (!open || !analysis || !localAnalysis || !baseAnalysis) return null

  const resolvedBaseAnalysis = baseAnalysis
  const resolvedLocalAnalysis = localAnalysis

  const digiKeyEligibleCount = resolvedBaseAnalysis.classifiedRows.filter(
    (row) => row.confidence === 'ambiguous' && row.category !== 'skip' && row.mpn.trim(),
  ).length

  async function handleBulkDigiKeyReview() {
    const ambiguousRows = resolvedBaseAnalysis.classifiedRows.filter(
      (row) => row.confidence === 'ambiguous' && row.category !== 'skip' && row.mpn.trim(),
    )
    if (!ambiguousRows.length) return

    setBulkDigiKeyLoading(true)
    setBulkDigiKeyError(null)
    setBulkDigiKeySuccess(null)
    try {
      const result = await classifyPickPlaceRowsWithDigiKeyAction({
        rows: ambiguousRows.map(toDigiKeyRowInput),
      })
      if (!result.ok) throw new Error(result.detail)

      const nextOverrides = { ...manualOverrides }
      const confirmedDesignators: string[] = []
      const classificationByDesignator = new Map(
        result.classifications.map((classification) => [
          classification.designator.toUpperCase(),
          classification,
        ]),
      )

      for (const [index, row] of resolvedBaseAnalysis.classifiedRows.entries()) {
        if (row.confidence !== 'ambiguous' || row.category === 'skip' || !row.mpn.trim()) continue
        const classification = classificationByDesignator.get(row.designator.toUpperCase())
        if (!classification) continue
        nextOverrides[buildPickPlaceRowKey(row, index)] = toManualOverrideFromDigiKey(classification)
        confirmedDesignators.push(classification.designator)
      }

      setManualOverrides(nextOverrides)
      setLocalAnalysis(applyPickPlaceManualOverrides(resolvedBaseAnalysis, nextOverrides))
      setEditingRowKey(null)
      if (confirmedDesignators.length) {
        setBulkDigiKeySuccess(confirmedDesignators)
      }
      if (result.skipped.length) {
        setBulkDigiKeyError(`조회 실패 ${result.skipped.length}건: ${result.skipped.slice(0, 3).join(', ')}${result.skipped.length > 3 ? '…' : ''}`)
      }
    } catch (caught) {
      setBulkDigiKeyError(caught instanceof Error ? caught.message : 'DigiKey 조회 중 오류가 발생했습니다.')
    } finally {
      setBulkDigiKeyLoading(false)
    }
  }

  async function handleBulkAiReview() {
    const ambiguousRows = resolvedBaseAnalysis.classifiedRows.filter(
      (row) => row.confidence === 'ambiguous' && row.category !== 'skip',
    )
    if (!ambiguousRows.length) return

    setBulkAiLoading(true)
    setBulkAiError(null)
    try {
      const result = await classifyPickPlaceRowsAction({
        rows: ambiguousRows.map(toAiRowInput),
      })
      if (!result.ok) throw new Error(result.detail)

      const nextOverrides = { ...manualOverrides }
      const classificationByDesignator = new Map(
        result.classifications.map((classification) => [
          classification.designator.toUpperCase(),
          classification,
        ]),
      )

      for (const [index, row] of resolvedBaseAnalysis.classifiedRows.entries()) {
        if (row.confidence !== 'ambiguous' || row.category === 'skip') continue
        const classification = classificationByDesignator.get(row.designator.toUpperCase())
        if (!classification) continue
        nextOverrides[buildPickPlaceRowKey(row, index)] = toManualOverrideFromAi(classification)
      }

      setManualOverrides(nextOverrides)
      setLocalAnalysis(applyPickPlaceManualOverrides(resolvedBaseAnalysis, nextOverrides))
      setEditingRowKey(null)
    } catch (caught) {
      setBulkAiError(caught instanceof Error ? caught.message : 'AI 일괄 검토 중 오류가 발생했습니다.')
    } finally {
      setBulkAiLoading(false)
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
    const nextDipForms = dipTarget
      ? dipForms.map((board, index) =>
          index === boardIndex
            ? applyAltiumPickPlaceToDipBoardForm(board, resolvedLocalAnalysis.summary)
            : board,
        )
      : undefined
    onApply({
      smtForms: nextForms,
      dipForms: nextDipForms,
      productName: productName.trim() || resolvedLocalAnalysis.summary.pcbName,
      analysis: resolvedLocalAnalysis,
    })
  }

  const hasUnresolved = resolvedLocalAnalysis.ambiguousCount > 0

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
          {hasUnresolved ? (
            <p className="text-xs text-amber-700">
              검토 필요 {resolvedLocalAnalysis.ambiguousCount}건 — 뱃지를 눌러 분류하거나 DigiKey/AI 검토를 사용하세요.
            </p>
          ) : (
            <p className="text-xs text-emerald-700">모든 항목이 확인되었습니다.</p>
          )}
          <div className="flex gap-2">
            <ErpButton variant="secondary" onClick={() => requestClose?.() ?? onClose()}>
              취소
            </ErpButton>
            <ErpButton onClick={handleApply} disabled={hasUnresolved}>
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
        onToggleRows={() => setShowAllRows((current) => !current)}
        editingRowKey={editingRowKey}
        onStartEdit={setEditingRowKey}
        onConfirmOverride={handleConfirmOverride}
        onCancelEdit={() => setEditingRowKey(null)}
        onBulkAiReview={() => void handleBulkAiReview()}
        bulkAiLoading={bulkAiLoading}
        bulkAiError={bulkAiError}
        onBulkDigiKeyReview={() => void handleBulkDigiKeyReview()}
        bulkDigiKeyLoading={bulkDigiKeyLoading}
        bulkDigiKeyError={bulkDigiKeyError}
        bulkDigiKeySuccess={bulkDigiKeySuccess}
        digiKeyEligibleCount={digiKeyEligibleCount}
      />
    </ErpModal>
  )
}
