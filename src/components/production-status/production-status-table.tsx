'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
  ProductionStatusStage,
} from '@/lib/production-status/types'

type ProductionStatusTableProps = {
  lines: ProductionStatusLine[]
  onStageClick?: (
    line: ProductionStatusLine,
    stage: ProductionStatusStage,
    product?: ProductionStatusProductLine,
  ) => void
}

function MiniProgress({
  percent,
  defectPercent = 0,
  tone,
}: {
  percent: number
  defectPercent?: number
  tone: 'sky' | 'emerald' | 'violet'
}) {
  const barClass =
    tone === 'sky' ? 'bg-sky-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-violet-500'
  const totalPercent = Math.min(100, percent + defectPercent)

  return (
    <div className="min-w-[108px]">
      <div className="mb-1.5 flex justify-between text-xs font-semibold text-slate-600">
        <span className="tabular-nums">{totalPercent}%</span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-100">
        {percent > 0 ? (
          <div className={`h-full shrink-0 ${barClass}`} style={{ width: `${percent}%` }} />
        ) : null}
        {defectPercent > 0 ? (
          <div className="h-full shrink-0 bg-rose-500" style={{ width: `${defectPercent}%` }} />
        ) : null}
      </div>
    </div>
  )
}

function StageCell({
  percent,
  defectPercent = 0,
  tone,
  detail,
  label,
  empty,
  onClick,
}: {
  percent: number
  defectPercent?: number
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
      <td className="px-4 py-3.5">
        <MiniProgress percent={percent} defectPercent={defectPercent} tone={tone} />
        <p className="mt-1.5 text-xs tabular-nums text-slate-500">{detail}</p>
      </td>
    )
  }

  return (
    <td className="px-2 py-2">
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
        title={`${label} 총관리자 직접 입력`}
        className="w-full rounded-xl px-2.5 py-2 text-left transition hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
      >
        <MiniProgress percent={percent} defectPercent={defectPercent} tone={tone} />
        <p className="mt-1.5 text-xs tabular-nums text-slate-500">{detail}</p>
      </button>
    </td>
  )
}

function stageDetail(produced: number, defected: number, target: number) {
  const base = `${produced.toLocaleString('ko-KR')} / ${target.toLocaleString('ko-KR')}`
  if (defected <= 0) return base
  return `${base} · 불량 ${defected.toLocaleString('ko-KR')}`
}

/** 분할생산이므로 공정 단계가 아니라 출하 완료 여부만 표시 */
function ProductionLineStatusBadge({
  deliveryProduced,
  deliveryTarget,
}: {
  deliveryProduced: number
  deliveryTarget: number
}) {
  if (deliveryTarget <= 0) {
    return (
      <span className="inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-slate-500">
        대상없음
      </span>
    )
  }
  if (deliveryProduced >= deliveryTarget) {
    return (
      <span className="inline-flex rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-bold text-emerald-700 ring-1 ring-emerald-200">
        완료
      </span>
    )
  }
  return (
    <span className="inline-flex rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-amber-200">
      진행중
    </span>
  )
}

function StageCells({
  smtPercent,
  smtDefectPercent,
  smtProduced,
  smtDefected,
  smtTarget,
  postPercent,
  postDefectPercent,
  postProduced,
  postDefected,
  postTarget,
  deliveryPercent,
  deliveryProduced,
  deliveryTarget,
  onSmtClick,
  onPostClick,
  onDeliveryClick,
}: {
  smtPercent: number
  smtDefectPercent: number
  smtProduced: number
  smtDefected: number
  smtTarget: number
  postPercent: number
  postDefectPercent: number
  postProduced: number
  postDefected: number
  postTarget: number
  deliveryPercent: number
  deliveryProduced: number
  deliveryTarget: number
  onSmtClick?: () => void
  onPostClick?: () => void
  onDeliveryClick?: () => void
}) {
  return (
    <>
      <StageCell
        percent={smtPercent}
        defectPercent={smtDefectPercent}
        tone="sky"
        label="SMT"
        empty={smtTarget <= 0}
        detail={stageDetail(smtProduced, smtDefected, smtTarget)}
        onClick={onSmtClick}
      />
      <StageCell
        percent={postPercent}
        defectPercent={postDefectPercent}
        tone="emerald"
        label="후공정"
        empty={postTarget <= 0}
        detail={stageDetail(postProduced, postDefected, postTarget)}
        onClick={onPostClick}
      />
      <StageCell
        percent={deliveryPercent}
        tone="violet"
        label="출하"
        empty={deliveryTarget <= 0}
        detail={`${deliveryProduced.toLocaleString('ko-KR')} / ${deliveryTarget.toLocaleString('ko-KR')}`}
        onClick={onDeliveryClick}
      />
    </>
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
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="min-h-0 flex-1 overflow-auto">
        <table className="min-w-[1120px] w-full border-collapse">
          <thead className="sticky top-0 z-[1] bg-slate-50/95 backdrop-blur-sm">
            <tr>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                주문서
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                고객사
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                제품
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                납기
              </th>
              <th className="px-4 py-3.5 pr-10 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">
                수량
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                SMT
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                후공정
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                출하
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                상태
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => (
              <OrderStatusRows key={line.orderId} line={line} onStageClick={onStageClick} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OrderStatusRows({
  line,
  onStageClick,
}: {
  line: ProductionStatusLine
  onStageClick?: ProductionStatusTableProps['onStageClick']
}) {
  if (line.products.length === 0) {
    return (
      <tr className="border-t border-slate-200 bg-white hover:bg-slate-50/70">
        <td className="px-4 py-3.5 font-mono text-sm font-bold text-slate-900" title={line.orderNumber}>
          {formatInternalCodeLabel(line.orderNumber)}
        </td>
        <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{line.customer || '—'}</td>
        <td className="px-4 py-3.5 text-sm font-medium text-slate-900">{line.productName || '—'}</td>
        <td className="whitespace-nowrap px-4 py-3">
          <DeliveryDueBadge
            deliveryDate={line.deliveryDate}
            done={line.deliveryTarget > 0 && line.deliveryProduced >= line.deliveryTarget}
          />
        </td>
        <td className="px-4 py-3 pr-10 text-right text-sm tabular-nums text-slate-700">
          {line.quantity.toLocaleString('ko-KR')}
        </td>
        <StageCells
          smtPercent={line.smtPercent}
          smtDefectPercent={line.smtDefectPercent}
          smtProduced={line.smtProduced}
          smtDefected={line.smtDefected}
          smtTarget={line.smtTarget}
          postPercent={line.postPercent}
          postDefectPercent={line.postDefectPercent}
          postProduced={line.postProduced}
          postDefected={line.postDefected}
          postTarget={line.postTarget}
          deliveryPercent={line.deliveryPercent}
          deliveryProduced={line.deliveryProduced}
          deliveryTarget={line.deliveryTarget}
          onSmtClick={onStageClick ? () => onStageClick(line, 'smt') : undefined}
          onPostClick={onStageClick ? () => onStageClick(line, 'post_process') : undefined}
          onDeliveryClick={onStageClick ? () => onStageClick(line, 'delivery') : undefined}
        />
        <td className="px-4 py-3.5">
          <ProductionLineStatusBadge
            deliveryProduced={line.deliveryProduced}
            deliveryTarget={line.deliveryTarget}
          />
        </td>
      </tr>
    )
  }

  return (
    <>
      {line.products.map((product) => (
        <tr
          key={`${line.orderId}:${product.key}`}
          className="border-t border-slate-200 bg-white hover:bg-slate-50/70"
        >
          <td className="px-4 py-3.5 font-mono text-sm font-bold text-slate-900" title={line.orderNumber}>
            {formatInternalCodeLabel(line.orderNumber)}
          </td>
          <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{line.customer || '—'}</td>
          <td className="px-4 py-3.5 text-sm text-slate-900">
            <span className="font-medium">{product.productName || '—'}</span>
            {product.productCode ? (
              <span className="ml-1.5 font-mono text-[11px] text-slate-400">[{product.productCode}]</span>
            ) : null}
          </td>
          <td className="whitespace-nowrap px-4 py-3">
            <DeliveryDueBadge
              deliveryDate={line.deliveryDate}
              done={product.deliveryTarget > 0 && product.deliveryProduced >= product.deliveryTarget}
            />
          </td>
          <td className="px-4 py-3 pr-10 text-right text-sm tabular-nums text-slate-700">
            {product.quantity.toLocaleString('ko-KR')}
          </td>
          <StageCells
            smtPercent={product.smtPercent}
            smtDefectPercent={product.smtDefectPercent}
            smtProduced={product.smtProduced}
            smtDefected={product.smtDefected}
            smtTarget={product.smtTarget}
            postPercent={product.postPercent}
            postDefectPercent={product.postDefectPercent}
            postProduced={product.postProduced}
            postDefected={product.postDefected}
            postTarget={product.postTarget}
            deliveryPercent={product.deliveryPercent}
            deliveryProduced={product.deliveryProduced}
            deliveryTarget={product.deliveryTarget}
            onSmtClick={
              onStageClick && product.smtTarget > 0
                ? () => onStageClick(line, 'smt', product)
                : undefined
            }
            onPostClick={
              onStageClick && product.postTarget > 0
                ? () => onStageClick(line, 'post_process', product)
                : undefined
            }
            onDeliveryClick={
              onStageClick && product.deliveryTarget > 0
                ? () => onStageClick(line, 'delivery', product)
                : undefined
            }
          />
          <td className="px-4 py-3.5">
            <ProductionLineStatusBadge
              deliveryProduced={product.deliveryProduced}
              deliveryTarget={product.deliveryTarget}
            />
          </td>
        </tr>
      ))}
    </>
  )
}
