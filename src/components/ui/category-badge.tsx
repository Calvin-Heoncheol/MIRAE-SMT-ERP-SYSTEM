import { ERP_BADGE_CLASS } from '@/lib/ui/tokens'

type CategoryBadgeProps = {
  label: string
  className?: string
}

export function CategoryBadge({ label, className }: CategoryBadgeProps) {
  return (
    <span className={`${ERP_BADGE_CLASS} ${className || 'bg-slate-100 text-slate-700'}`}>
      {label}
    </span>
  )
}
