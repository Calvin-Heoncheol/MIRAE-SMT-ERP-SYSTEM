'use client'

import { displayOrderPoNumber } from '@/lib/orders/utils'

/** 생산현황 — 발주번호 아래 작업번호 */
export function ProductionOrderPoLabel({
  customerPoNumber,
  orderNumber,
  workNumber,
  className,
  workClassName,
}: {
  customerPoNumber?: string | null
  orderNumber?: string | null
  workNumber?: string | null
  className?: string
  workClassName?: string
}) {
  const po = displayOrderPoNumber(customerPoNumber, orderNumber)
  const work = String(workNumber || '').trim()

  return (
    <span className={['inline-flex min-w-0 flex-col', className].filter(Boolean).join(' ')}>
      <span className="truncate">{po || '—'}</span>
      {work ? (
        <span
          className={
            workClassName ||
            'mt-0.5 truncate font-mono text-[10px] font-medium leading-tight text-slate-500'
          }
        >
          {work}
        </span>
      ) : null}
    </span>
  )
}
