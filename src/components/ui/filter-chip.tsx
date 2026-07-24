'use client'

import {
  ERP_FILTER_CHIP_ACTIVE_CLASS,
  ERP_FILTER_CHIP_IDLE_CLASS,
} from '@/lib/ui/tokens'

export type FilterChipTone = {
  idleClassName?: string
  activeClassName?: string
  activeCountClassName?: string
}

export const FILTER_CHIP_BASE_CLASS =
  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors'

export function filterChipClassName(active: boolean, tone?: FilterChipTone) {
  const idle = tone?.idleClassName ?? ERP_FILTER_CHIP_IDLE_CLASS
  const activeCls = tone?.activeClassName ?? ERP_FILTER_CHIP_ACTIVE_CLASS
  return [FILTER_CHIP_BASE_CLASS, active ? activeCls : idle].join(' ')
}

export function filterChipCountClassName(active: boolean, tone?: FilterChipTone) {
  if (active) return tone?.activeCountClassName ?? 'text-slate-300'
  return 'opacity-70'
}

export const STATUS_FILTER_TONES = {
  waiting: {
    idleClassName: 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100',
    activeClassName: 'bg-slate-700 text-white shadow-sm',
    activeCountClassName: 'text-slate-300',
  },
  progress: {
    idleClassName: 'border border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100',
    activeClassName: 'bg-amber-600 text-white shadow-sm',
    activeCountClassName: 'text-amber-100',
  },
  done: {
    idleClassName: 'border border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
    activeClassName: 'bg-emerald-700 text-white shadow-sm',
    activeCountClassName: 'text-emerald-100',
  },
} as const

type FilterChipProps = {
  label: string
  active: boolean
  count?: number
  tone?: FilterChipTone
  onClick: () => void
}

export function FilterChip({ label, active, count, tone, onClick }: FilterChipProps) {
  return (
    <button type="button" onClick={onClick} className={filterChipClassName(active, tone)}>
      <span>{label}</span>
      {count != null ? (
        <span className={`tabular-nums ${filterChipCountClassName(active, tone)}`}>
          {count.toLocaleString('ko-KR')}
        </span>
      ) : null}
    </button>
  )
}

export type FilterChipOption<T extends string | number> = {
  value: T
  label: string
  count?: number
  tone?: FilterChipTone
}

type FilterChipBarProps<T extends string | number> = {
  options: FilterChipOption<T>[]
  value: T | null
  onChange: (value: T) => void
  className?: string
}

export function FilterChipBar<T extends string | number>({
  options,
  value,
  onChange,
  className,
}: FilterChipBarProps<T>) {
  return (
    <div className={['flex flex-wrap gap-1.5', className].filter(Boolean).join(' ')}>
      {options.map((option) => (
        <FilterChip
          key={option.value}
          label={option.label}
          active={value === option.value}
          count={option.count}
          tone={option.tone}
          onClick={() => onChange(option.value)}
        />
      ))}
    </div>
  )
}
