type HomeKpiCardProps = {
  value: string
  label: string
  hint?: string
  tone?: 'default' | 'warn' | 'danger'
}

export function HomeKpiCard({ value, label, hint, tone = 'default' }: HomeKpiCardProps) {
  const borderTone =
    tone === 'danger' ? 'border-l-red-600' : tone === 'warn' ? 'border-l-amber-600' : 'border-l-slate-200'
  const valueTone =
    tone === 'danger' ? 'text-red-700' : tone === 'warn' ? 'text-amber-800' : 'text-slate-900'

  return (
    <div
      className={[
        'rounded-xl border border-slate-200/80 border-l-[3px] bg-white/90 px-4 py-4 shadow-sm backdrop-blur-sm',
        borderTone,
      ].join(' ')}
    >
      <div className={`text-[26px] font-bold leading-none tracking-tight tabular-nums ${valueTone}`}>
        {value}
      </div>
      <div className="mt-1.5 text-xs font-medium text-slate-500">{label}</div>
      {hint ? <div className="mt-1 text-[11px] font-medium text-slate-400">{hint}</div> : null}
    </div>
  )
}
