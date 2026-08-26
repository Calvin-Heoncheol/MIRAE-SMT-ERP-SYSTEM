type KpiStatCardProps = {
  label: string
  value: number | string | null
  unit?: string
  /** 메인 값 아래 보조 표기 (예: 달러 합계) */
  secondary?: string | null
  hint?: string
  tone?: 'default' | 'sky' | 'emerald' | 'amber' | 'slate' | 'rose'
  className?: string
}

const VALUE_TONE: Record<NonNullable<KpiStatCardProps['tone']>, string> = {
  default: 'text-slate-900',
  sky: 'text-sky-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  slate: 'text-slate-700',
  rose: 'text-rose-700',
}

/** 현황 페이지 공통 통계 카드 — 낮은 높이 */
export function KpiStatCard({
  label,
  value,
  unit,
  secondary,
  hint,
  tone = 'default',
  className = '',
}: KpiStatCardProps) {
  const display =
    value == null ? '–' : typeof value === 'number' ? value.toLocaleString('ko-KR') : value
  const secondaryText = String(secondary || '').trim()

  return (
    <div
      className={[
        'rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="text-[11px] leading-none font-semibold text-slate-500">{label}</p>
      <p className={`mt-1.5 text-[22px] leading-none font-bold tabular-nums ${VALUE_TONE[tone]}`}>
        {display}
        {unit ? <span className="ml-1 text-[11px] font-semibold text-slate-400">{unit}</span> : null}
      </p>
      {secondaryText ? (
        <p className="mt-1 text-[12px] leading-none font-semibold tabular-nums text-slate-600">
          {secondaryText}
        </p>
      ) : null}
      {hint ? (
        <p className="mt-1 truncate text-[10px] leading-none font-medium text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}
