import type { MaterialInboundStatus } from '@/lib/materials/material-inbound-status'
import {
  formatMaterialInboundStatusLabel,
  formatSmtPlanMaterialStatusLabel,
} from '@/lib/materials/material-inbound-status'
import { ERP_BADGE_COMPACT_CLASS } from '@/lib/ui/tokens'

function badgeTone(status: MaterialInboundStatus) {
  if (status === 'ready') return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  if (status === 'scheduled') return 'bg-sky-50 text-sky-700 ring-sky-200'
  if (status === 'missing') return 'bg-rose-50 text-rose-700 ring-rose-200'
  return 'bg-slate-100 text-slate-500 ring-slate-200'
}

function producibleTone(readyUnits: number) {
  if (readyUnits > 0) return 'bg-emerald-50 text-emerald-700 ring-emerald-200'
  return 'bg-slate-100 text-slate-500 ring-slate-200'
}

/** 현재고 기준 생산 가능 대수 */
export function MaterialProducibleUnitsBadge({
  readyUnits,
}: {
  readyUnits?: number | null
}) {
  const units = Math.max(0, Math.floor(Number(readyUnits) || 0))
  return (
    <span
      className={`${ERP_BADGE_COMPACT_CLASS} ${producibleTone(units)}`}
      title="현재고만으로 생산 가능한 대수"
    >
      생산가능 {units.toLocaleString('ko-KR')}
    </span>
  )
}

export function MaterialInboundStatusBadge({
  status,
  expectedReadyDate,
  readyUnits,
}: {
  status: MaterialInboundStatus | null | undefined
  expectedReadyDate?: string | null
  readyUnits?: number | null
}) {
  if (!status || status === 'no_bom') return null
  const info = {
    status,
    expectedReadyDate: expectedReadyDate ?? null,
    readyUnits: Math.max(0, Math.floor(Number(readyUnits) || 0)),
    scheduledUnits: 0,
  }
  return (
    <span
      className={`${ERP_BADGE_COMPACT_CLASS} ${badgeTone(status)}`}
      title={`자재상태: ${formatMaterialInboundStatusLabel(info)}`}
    >
      {formatMaterialInboundStatusLabel(info)}
    </span>
  )
}

/**
 * SMT 생산계획용: 미발주 / 입고예정 N대분 / 입고완료 N대분
 * (생산가능 뱃지와 중복되지 않게 한 장으로 표기)
 */
export function SmtPlanMaterialStatusBadge({
  status,
  expectedReadyDate,
  readyUnits,
  scheduledUnits,
}: {
  status: MaterialInboundStatus | null | undefined
  expectedReadyDate?: string | null
  readyUnits?: number | null
  scheduledUnits?: number | null
}) {
  if (!status || status === 'no_bom') return null
  const info = {
    status,
    expectedReadyDate: expectedReadyDate ?? null,
    readyUnits: Math.max(0, Math.floor(Number(readyUnits) || 0)),
    scheduledUnits: Math.max(0, Math.floor(Number(scheduledUnits) || 0)),
  }
  const label = formatSmtPlanMaterialStatusLabel(info)
  return (
    <span
      className={`${ERP_BADGE_COMPACT_CLASS} ${badgeTone(status)}`}
      title={`자재상태: ${label}`}
    >
      {label}
    </span>
  )
}
