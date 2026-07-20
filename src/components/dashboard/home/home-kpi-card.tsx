type HomeKpiCardProps = {
  value: string
  label: string
  hint?: string
  tone?: 'default' | 'warn' | 'danger'
}

const TONE = {
  default: {
    shell: 'border-slate-200 bg-white hover:border-slate-300',
    accent: 'bg-slate-800',
    value: 'text-slate-900',
    chip: 'bg-slate-100 text-slate-600',
  },
  warn: {
    shell: 'border-amber-200/80 bg-white hover:border-amber-300',
    accent: 'bg-amber-500',
    value: 'text-amber-950',
    chip: 'bg-amber-50 text-amber-800',
  },
  danger: {
    shell: 'border-rose-200/80 bg-white hover:border-rose-300',
    accent: 'bg-rose-500',
    value: 'text-rose-950',
    chip: 'bg-rose-50 text-rose-800',
  },
} as const

export function HomeKpiCard({ value, label, hint, tone = 'default' }: HomeKpiCardProps) {
  const t = TONE[tone]

  return (
    <div
      className={`group relative overflow-hidden rounded-2xl border p-4 shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${t.shell}`}
    >
      <span className={`absolute inset-y-0 left-0 w-1 ${t.accent}`} aria-hidden />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500">{label}</p>
          {hint ? (
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${t.chip}`}>{hint}</span>
          ) : null}
        </div>
        <p className={`mt-3 text-3xl font-bold leading-none tabular-nums tracking-tight ${t.value}`}>
          {value}
        </p>
      </div>
    </div>
  )
}
