type HomeKpiCardProps = {
  value: string
  label: string
  hint?: string
  tone?: 'default' | 'warn' | 'danger'
}

const TONE = {
  default: {
    shell: 'border-slate-200/90 bg-white',
    bar: 'bg-gradient-to-r from-blue-500 to-indigo-500',
    glow: 'bg-blue-400/10',
    value: 'text-slate-900',
    chip: 'bg-slate-100 text-slate-600',
  },
  warn: {
    shell: 'border-amber-200/90 bg-gradient-to-br from-white via-white to-amber-50/60',
    bar: 'bg-gradient-to-r from-amber-400 to-orange-500',
    glow: 'bg-amber-400/15',
    value: 'text-amber-900',
    chip: 'bg-amber-100 text-amber-800',
  },
  danger: {
    shell: 'border-red-200/90 bg-gradient-to-br from-white via-white to-red-50/50',
    bar: 'bg-gradient-to-r from-red-500 to-rose-600',
    glow: 'bg-red-400/10',
    value: 'text-red-800',
    chip: 'bg-red-100 text-red-700',
  },
} as const

export function HomeKpiCard({ value, label, hint, tone = 'default' }: HomeKpiCardProps) {
  const t = TONE[tone]

  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 shadow-sm transition hover:shadow-md ${t.shell}`}>
      <div className={`pointer-events-none absolute -top-8 -right-8 h-24 w-24 rounded-full blur-2xl ${t.glow}`} />
      <div className={`mb-3 h-1 w-9 rounded-full ${t.bar}`} />
      <div className={`text-[28px] font-bold leading-none tabular-nums tracking-tight ${t.value}`}>{value}</div>
      <div className="mt-2 text-sm font-semibold text-slate-700">{label}</div>
      {hint ? (
        <span className={`mt-2 inline-block rounded-md px-2 py-0.5 text-[11px] font-medium ${t.chip}`}>{hint}</span>
      ) : null}
    </div>
  )
}
