const BADGE_BASE =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold'

type CategoryBadgeProps = {
  label: string
  className?: string
}

export function CategoryBadge({ label, className }: CategoryBadgeProps) {
  return (
    <span className={`${BADGE_BASE} ${className || 'bg-slate-100 text-slate-700'}`}>
      {label}
    </span>
  )
}
