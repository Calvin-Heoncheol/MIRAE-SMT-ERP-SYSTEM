type KpiStatCardProps = {
  label: string
  value: number | string | null
  unit?: string
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

/** 홈 KPI / 주문별 현황 공통 통계 카드 밀도 */
export function KpiStatCard({
  label,
  value,
  unit,
  hint,
  tone = 'default',
  className = '',
}: KpiStatCardProps) {
  const display =
    value == null ? '–' : typeof value === 'number' ? value.toLocaleString('ko-KR') : value

  return (
    <div
      className={[
        'rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-sm',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <p className="text-[11px] font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${VALUE_TONE[tone]}`}>
        {display}
        {unit ? <span className="ml-1 text-xs font-semibold text-slate-400">{unit}</span> : null}
      </p>
      {hint ? (
        <p className="mt-0.5 truncate text-[11px] font-medium text-slate-500">{hint}</p>
      ) : null}
    </div>
  )
}
