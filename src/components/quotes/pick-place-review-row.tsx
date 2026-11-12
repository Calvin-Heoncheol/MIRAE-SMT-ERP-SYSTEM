'use client'

import { Fragment, useState } from 'react'
import { formatPickPlaceSideLabel } from '@/lib/quotes/canonical-pick-place'
import {
  PICK_PLACE_CONFIDENCE_STYLES,
  PICK_PLACE_DIP_CATEGORY_OPTIONS,
  PICK_PLACE_SMD_CATEGORY_OPTIONS,
  suggestBgaBallCountForRow,
  suggestIcPinCountForRow,
  suggestPickPlaceDipCategory,
  suggestPickPlaceMountType,
  type PickPlaceClassifiedRow,
  type PickPlaceComponentCategory,
  type PickPlaceManualOverride,
  type PickPlaceMountType,
} from '@/lib/quotes/parse-altium-pick-place'
import { classifyPickPlaceRowsWithDigiKeyAction } from '@/lib/quotes/pick-place-digikey-actions'
import type { PickPlaceDigiKeyClassification } from '@/lib/quotes/digikey-types'
import { classifyPickPlaceRowsAction } from '@/lib/quotes/pick-place-ai-actions'
import type { PickPlaceAiClassification } from '@/lib/quotes/pick-place-ai-types'
import { isPickPlaceDipCategory } from '@/lib/quotes/pick-place-mount-categories'
import { isPickPlaceBomUnpopulatedRow } from '@/lib/quotes/bom-dnp'
import {
  BomUnpopulatedBadge,
  ConfidenceBadge,
  ProcessBadge,
  ReviewSourceBadge,
} from '@/components/quotes/pick-place-review-parts'

export function toAiRowInput(row: PickPlaceClassifiedRow) {
  return {
    designator: row.designator,
    side: row.side,
    package: row.package,
    value: row.value,
    description: row.description,
    mpn: row.mpn,
    currentCategory: row.category,
    currentDetail: row.detail,
  }
}

export function toManualOverrideFromAi(classification: PickPlaceAiClassification): PickPlaceManualOverride {
  const override: PickPlaceManualOverride = {
    category: classification.category,
    source: 'ai',
    aiReason: classification.reason,
  }
  if (classification.icPinCount) override.icPinCount = classification.icPinCount
  if (classification.bgaBallCount) override.bgaBallCount = classification.bgaBallCount
  return override
}

export function toDigiKeyRowInput(row: PickPlaceClassifiedRow) {
  return {
    designator: row.designator,
    mpn: row.mpn,
    package: row.package,
    value: row.value,
    description: row.description,
    currentCategory: row.category,
  }
}

export function toManualOverrideFromDigiKey(
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
  const dipHandOptions = PICK_PLACE_DIP_CATEGORY_OPTIONS
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
              <p className="mt-1 text-[11px] text-amber-900/80">수납땜 소/중/대형</p>
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
                <span className="mt-0.5 block text-[11px] text-slate-500">{option.hint}</span>
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
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-500">수납땜</p>
            <div className="grid gap-2 sm:grid-cols-4">
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
                  <span className="mt-0.5 block text-[11px] text-slate-500">{option.hint}</span>
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

export function ReviewRow({
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
              <span className="inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-600 ring-1 ring-inset ring-slate-300">
                미실장
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-2 py-2 text-center">
          {bomUnpopulated ? <span className="text-xs text-slate-400">—</span> : <ProcessBadge row={row} />}
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
          <td colSpan={9} className="px-2 py-2">
            <ManualReviewPanel row={row} onConfirm={onConfirm} onCancel={onCancel} />
          </td>
        </tr>
      ) : null}
    </Fragment>
  )
}
