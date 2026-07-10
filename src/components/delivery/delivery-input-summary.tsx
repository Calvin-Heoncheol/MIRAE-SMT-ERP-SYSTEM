'use client'

import type { DeliveryInputSummary } from '@/lib/delivery/utils'

type DeliveryInputSummaryProps = {
  summary: DeliveryInputSummary
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string
  value: number
  hint?: string
  tone?: 'default' | 'accent' | 'warn' | 'muted'
}) {
  const valueClass =
    tone === 'accent'
      ? 'text-blue-700'
      : tone === 'warn'
        ? 'text-amber-700'
        : tone === 'muted'
          ? 'text-slate-500'
          : 'text-slate-900'

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueClass}`}>
        {value.toLocaleString('ko-KR')}
        <span className="ml-1 text-sm font-semibold text-slate-400">건</span>
      </p>
      {hint ? <p className="mt-1 text-xs text-slate-400">{hint}</p> : null}
    </div>
  )
}

export function DeliveryInputSummary({ summary }: DeliveryInputSummaryProps) {
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <SummaryCard label="출하 가능" value={summary.shippable} tone="accent" hint="지금 등록 가능" />
      <SummaryCard label="부분 출하" value={summary.partial} tone="warn" hint="일부만 출하됨" />
      <SummaryCard label="출하 완료" value={summary.complete} tone="muted" />
      <SummaryCard label="출하 불가" value={summary.blocked} hint="생산·재고 확인 필요" />
    </div>
  )
}
