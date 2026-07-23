'use client'

import { useState } from 'react'
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set())

  function toggleExpanded(orderId: string) {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(orderId)) next.delete(orderId)
      else next.add(orderId)
      return next
    })
  }

  if (!lines.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white/80 px-6 py-16 text-center">
        <p className="text-base font-semibold text-slate-700">표시할 주문서가 없습니다</p>
        <p className="mt-2 text-sm text-slate-500">주문서를 등록하면 생산 현황이 여기에 표시됩니다.</p>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1080px] w-full border-collapse">
          <thead className="bg-slate-50/90">
            <tr>
              <th className="w-10 px-2 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <span className="sr-only">펼치기</span>
              </th>
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
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              // 제품 2개 이상만 펼침 — 1개면 요약 행만으로 충분
              const canExpand = line.products.length > 1
              const expanded = canExpand && expandedIds.has(line.orderId)

              return (
                <OrderStatusRows
                  key={line.orderId}
                  line={line}
                  expanded={expanded}
                  canExpand={canExpand}
                  onToggle={() => toggleExpanded(line.orderId)}
                  onStageClick={onStageClick}
                />
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function OrderStatusRows({
  line,
  expanded,
  canExpand,
  onToggle,
  onStageClick,
}: {
  line: ProductionStatusLine
  expanded: boolean
  canExpand: boolean
  onToggle: () => void
  onStageClick?: ProductionStatusTableProps['onStageClick']
}) {
  return (
    <>
      <tr
        className={[
          'border-t border-slate-200',
          canExpand ? 'cursor-pointer hover:bg-slate-50' : 'hover:bg-slate-50/70',
          expanded ? 'bg-slate-100/90' : 'bg-white',
        ].join(' ')}
        onClick={canExpand ? onToggle : undefined}
      >
        <td className="px-2 py-3">
          {canExpand ? (
            <button
              type="button"
              aria-expanded={expanded}
              aria-label={expanded ? '제품 목록 접기' : '제품 목록 펼치기'}
              onClick={(event) => {
                event.stopPropagation()
                onToggle()
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800"
            >
              <span className="text-[11px] leading-none" aria-hidden>
                {expanded ? '▾' : '▸'}
              </span>
            </button>
          ) : (
            <span className="block w-7" />
          )}
        </td>
        <td className="px-4 py-3.5 font-mono text-sm font-bold text-slate-900" title={line.orderNumber}>
          {formatInternalCodeLabel(line.orderNumber)}
        </td>
        <td className="px-4 py-3.5 text-sm font-semibold text-slate-800">{line.customer || '—'}</td>
        <td className="px-4 py-3.5 text-sm font-medium text-slate-900">
          <span>{line.productName || '—'}</span>
          {line.productCount > 1 ? (
            <span className="ml-1.5 text-xs font-normal text-slate-400">
              ({line.productCount.toLocaleString('ko-KR')}개)
            </span>
          ) : null}
        </td>
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
      </tr>

      {expanded
        ? line.products.map((product) => (
            <tr
              key={`${line.orderId}:${product.key}`}
              className="border-t border-sky-100/80 bg-sky-50/60 hover:bg-sky-50"
            >
              <td className="border-l-2 border-sky-300 px-2 py-2" />
              <td className="px-4 py-2.5 pl-6 text-xs text-slate-400">└</td>
              <td className="px-4 py-2.5 text-xs text-slate-400">—</td>
              <td className="px-4 py-2.5 pl-6 text-sm text-slate-700">
                <span className="font-medium">{product.productName}</span>
                {product.productCode ? (
                  <span className="ml-1.5 font-mono text-[11px] text-slate-400">
                    [{product.productCode}]
                  </span>
                ) : null}
              </td>
              <td className="px-4 py-2.5 text-xs text-slate-400">—</td>
              <td className="px-4 py-2.5 pr-10 text-right text-sm tabular-nums text-slate-600">
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
            </tr>
          ))
        : null}
    </>
  )
}
