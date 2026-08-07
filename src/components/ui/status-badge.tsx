import { ERP_BADGE_CLASS } from '@/lib/ui/tokens'

type StatusBadgeProps = {
  label: string
  /** soft pastel classes e.g. bg-emerald-100 text-emerald-800 */
  className: string
}

export function StatusBadge({ label, className }: StatusBadgeProps) {
  return <span className={`${ERP_BADGE_CLASS} ${className}`}>{label}</span>
}

/** 결재 상태 공통 */
export function SignoffStatusBadge({ label }: { label: string }) {
  const done = label === '결재완료'
  return (
    <StatusBadge
      label={label}
      className={done ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}
    />
  )
}
