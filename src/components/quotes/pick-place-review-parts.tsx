'use client'
import {
  PICK_PLACE_CONFIDENCE_STYLES,
  pickPlaceConfidenceLabel,
  pickPlaceProcessHint,
  pickPlaceProcessLabel,
  type PickPlaceClassifiedRow,
  type PickPlaceConfidence,
  type PickPlaceReviewSource,
} from '@/lib/quotes/parse-altium-pick-place'
import { bomUnpopulatedBadgeHint } from '@/lib/quotes/bom-dnp'

export function BomUnpopulatedBadge({
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
      <span className="inline-flex rounded-full bg-slate-200 px-1.5 py-0.5 text-[11px] font-semibold text-slate-700 ring-1 ring-inset ring-slate-300">
        미실장
      </span>
      {hint ? <span className="text-[8px] font-medium text-slate-500">{hint}</span> : null}
    </span>
  )
}

export function ReviewSourceBadge({ source }: { source?: PickPlaceReviewSource }) {
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
        'inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        styles,
      ].join(' ')}
    >
      {label}
    </span>
  )
}
export function ConfidenceBadge({
  confidence,
  interactive = false,
  onClick,
}: {
  confidence: PickPlaceConfidence
  interactive?: boolean
  onClick?: () => void
}) {
  const className = [
    'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
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

export function QuoteFieldCard({
  label,
  value,
  confidence,
  note,
  compact = false,
  active = false,
  onClick,
}: {
  label: string
  value: string
  confidence: PickPlaceConfidence
  note?: string
  compact?: boolean
  active?: boolean
  onClick?: () => void
}) {
  if (compact) {
    const className = [
      'block w-full rounded-md border px-2 py-1.5 text-left',
      PICK_PLACE_CONFIDENCE_STYLES[confidence].card,
      onClick ? 'cursor-pointer transition hover:brightness-95' : '',
      active ? 'ring-2 ring-sky-500 ring-offset-1' : '',
    ].join(' ')
    const content = (
      <>
        <div className="flex items-center justify-between gap-1.5">
          <p className="text-[11px] font-medium leading-tight text-slate-600">{label}</p>
          <ConfidenceDot confidence={confidence} />
        </div>
        <p className="mt-0.5 text-xs font-semibold tabular-nums leading-tight text-slate-900">{value}</p>
        {note ? <p className="mt-0.5 truncate text-[11px] text-slate-500" title={note}>{note}</p> : null}
      </>
    )
    return onClick ? (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        title={active ? '필터 해제' : `${label} 부품만 보기`}
        className={className}
      >
        {content}
      </button>
    ) : (
      <div className={className}>{content}</div>
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
      {note ? <p className="mt-1 text-[11px] text-slate-500">{note}</p> : null}
    </div>
  )
}

export function ProcessBadge({ row }: { row: PickPlaceClassifiedRow }) {
  const label = pickPlaceProcessLabel(row)
  const hint = pickPlaceProcessHint(row)
  if (label === '—') {
    return <span className="text-xs text-slate-400">—</span>
  }

  const style =
    label === 'SMD'
      ? 'bg-sky-100 text-sky-800 ring-sky-200'
      : 'bg-amber-100 text-amber-900 ring-amber-200'

  return (
    <span
      className={[
        'inline-flex rounded-full px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        style,
      ].join(' ')}
      title={hint}
    >
      {label}
    </span>
  )
}
