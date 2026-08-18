import { ERP_BADGE_CLASS, ERP_STATUS_TONE_CLASS, type ErpStatusTone } from '@/lib/ui/tokens'

type StatusBadgeProps = {
  label: string
  tone?: ErpStatusTone
  /** tone 대신 직접 클래스. tone과 같이 쓰면 뒤에 붙음 */
  className?: string
}

export function StatusBadge({ label, tone, className = '' }: StatusBadgeProps) {
  const toneClass = tone ? ERP_STATUS_TONE_CLASS[tone] : ''
  return <span className={`${ERP_BADGE_CLASS} ${toneClass} ${className}`.trim()}>{label}</span>
}

/** 결재 상태 공통 */
export function SignoffStatusBadge({ label }: { label: string }) {
  const done = label === '결재완료'
  return <StatusBadge label={label} tone={done ? 'success' : 'warning'} />
}
