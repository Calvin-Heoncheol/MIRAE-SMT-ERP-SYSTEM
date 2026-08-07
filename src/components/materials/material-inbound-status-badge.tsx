import type { MaterialInboundStatus } from '@/lib/materials/material-inbound-status'
import { formatMaterialInboundStatusLabel } from '@/lib/materials/material-inbound-status'
import { ERP_BADGE_COMPACT_CLASS } from '@/lib/ui/tokens'

function badgeTone(status: MaterialInboundStatus) {
  if (status === 'ready') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (status === 'scheduled') return 'bg-sky-50 text-sky-700 ring-sky-200'
  if (status === 'missing') return 'bg-rose-50 text-rose-700 ring-rose-200'
  return 'bg-slate-100 text-slate-500 ring-slate-200'
}

export function MaterialInboundStatusBadge({
  status,
  expectedReadyDate,
}: {
  status: MaterialInboundStatus | null | undefined
  expectedReadyDate?: string | null
}) {
  if (!status) return null
  return (
    <span
      className={`${ERP_BADGE_COMPACT_CLASS} ${badgeTone(status)}`}
      title={`자재상태: ${formatMaterialInboundStatusLabel({
        status,
        expectedReadyDate: expectedReadyDate ?? null,
      })}`}
    >
      {formatMaterialInboundStatusLabel({
        status,
        expectedReadyDate: expectedReadyDate ?? null,
      })}
    </span>
  )
}
