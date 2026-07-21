import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type { ProductionStatusLine, ProductionStatusStage } from '@/lib/production-status/types'

type ProductionStatusTableProps = {
  lines: ProductionStatusLine[]
  onStageClick?: (line: ProductionStatusLine, stage: ProductionStatusStage) => void
}

function MiniProgress({ percent, tone }: { percent: number; tone: 'sky' | 'emerald' | 'violet' }) {
  const barClass =
    tone === 'sky' ? 'bg-sky-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-violet-500'

  return (
    <div className="min-w-[88px]">
      <div className="mb-1 flex justify-between text-[11px] font-medium text-slate-500">
        <span className="tabular-nums">{percent}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div className={`h-full rounded-full ${barClass}`} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}

function StageCell({
  percent,
  tone,
  detail,
  label,
  empty,
  onClick,
}: {
  percent: number
  tone: 'sky' | 'emerald' | 'violet'
  detail: string
  label: string
  empty?: boolean
  onClick?: () => void
}) {
  if (empty) {
    return (
      <td className="px-4 py-3">
        <span className="text-xs text-slate-400">없음</span>
      </td>
    )
  }

  if (!onClick) {
    return (
      <td className="px-4 py-3">
        <MiniProgress percent={percent} tone={tone} />
        <p className="mt-1 text-[11px] tabular-nums text-slate-400">{detail}</p>
      </td>
    )
  }

  return (
    <td className="px-2 py-2">
      <button
        type="button"
        onClick={onClick}
        title={`${label} 총관리자 직접 입력`}
        className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        <MiniProgress percent={percent} tone={tone} />
        <p className="mt-1 text-[11px] tabular-nums text-slate-400">{detail}</p>
      </button>
    </td>
  )
}

export function ProductionStatusTable({ lines, onStageClick }: ProductionStatusTableProps) {
  if (!lines.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">표시할 주문서가 없습니다</p>
        <p className="mt-2 text-sm text-slate-500">주문서를 등록하면 생산 현황이 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200/80 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[920px] w-full border-collapse">
          <thead className="bg-slate-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                주문서번호
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                고객사
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                제품
              </th>
              <th className="whitespace-nowrap px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                납기
              </th>
              <th className="px-4 py-3 pr-10 text-right text-xs font-semibold uppercase tracking-wide text-slate-600">
                수량
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                SMT
              </th>
              <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-600">
                후공정
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <tr key={line.orderId} className="border-t border-slate-100 hover:bg-slate-50/60">
                <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900" title={line.orderNumber}>
                  {formatInternalCodeLabel(line.orderNumber)}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{line.customer || '—'}</td>
                <td className="px-4 py-3 text-sm font-medium text-slate-900">{line.productName || '—'}</td>
                <td className="whitespace-nowrap px-4 py-3">
                  <DeliveryDueBadge
                    deliveryDate={line.deliveryDate}
                    done={line.deliveryTarget > 0 && line.deliveryProduced >= line.deliveryTarget}
                  />
                </td>
                <td className="px-4 py-3 pr-10 text-right text-sm tabular-nums text-slate-700">
                  {line.quantity.toLocaleString('ko-KR')}
                </td>
                <StageCell
                  percent={line.smtPercent}
                  tone="sky"
                  label="SMT"
                  empty={line.smtTarget <= 0}
                  detail={`${line.smtProduced.toLocaleString('ko-KR')} / ${line.smtTarget.toLocaleString('ko-KR')}`}
                  onClick={onStageClick ? () => onStageClick(line, 'smt') : undefined}
                />
                <StageCell
                  percent={line.postPercent}
                  tone="emerald"
                  label="후공정"
                  empty={line.postTarget <= 0}
                  detail={`${line.postProduced.toLocaleString('ko-KR')} / ${line.postTarget.toLocaleString('ko-KR')}`}
                  onClick={onStageClick ? () => onStageClick(line, 'post_process') : undefined}
                />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
