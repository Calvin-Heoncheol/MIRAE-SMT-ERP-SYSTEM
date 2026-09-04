'use client'

import { StatusBadge } from '@/components/ui/status-badge'
import type { ProductionOrderLine } from '@/lib/production-input/types'
import type { SmtPcbSide } from '@/lib/smt/types'

type ProductionInputSideBadgesProps = {
  order: ProductionOrderLine
  activeSide?: SmtPcbSide | null
  compact?: boolean
}

function sideBadgeClass(side: 'SINGLE' | 'TOP' | 'BOT', active: boolean, compact: boolean) {
  const size = compact ? '!px-2 !py-0.5 !text-[11px]' : '!px-2.5 !py-1 !text-xs'
  if (!active) return `${size} !bg-slate-100 !text-slate-500 ring-slate-200`
  if (side === 'TOP') return `${size} !bg-sky-100 !text-sky-800 ring-sky-200`
  if (side === 'BOT') return `${size} !bg-indigo-100 !text-indigo-800 ring-indigo-200`
  return `${size} !bg-slate-200 !text-slate-800 ring-slate-300`
}

export function ProductionInputSideBadges({
  order,
  activeSide = null,
  compact = false,
}: ProductionInputSideBadgesProps) {
  if (order.splitPcbSides) {
    const current =
      activeSide === 'TOP' || activeSide === 'BOT' ? activeSide : ('TOP' as const)
    return (
      <>
        {(['TOP', 'BOT'] as const).map((side) => (
          <StatusBadge
            key={side}
            label={side}
            className={sideBadgeClass(side, side === current, compact)}
          />
        ))}
      </>
    )
  }

  return (
    <StatusBadge
      label="SINGLE"
      className={sideBadgeClass('SINGLE', true, compact)}
    />
  )
}
