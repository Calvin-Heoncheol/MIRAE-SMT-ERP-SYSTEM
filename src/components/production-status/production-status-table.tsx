'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { formatInternalCodeLabel } from '@/lib/orders/utils'
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
  ProductionStatusStage,
} from '@/lib/production-status/types'
import { ERP_BADGE_COMPACT_CLASS, ERP_TABLE_SCROLL_CLASS, ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'

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
  detail,
}: {
  percent: number
  defectPercent?: number
  tone: 'sky' | 'emerald'
  detail: string
}) {
  const barClass = tone === 'sky' ? 'bg-sky-500' : 'bg-emerald-500'
  const goodWidth = Math.max(0, Math.min(100, percent))
  const defectWidth = Math.max(0, Math.min(100 - goodWidth, defectPercent))

  return (
    <div className="min-w-[108px]">
      <p className="mb-1.5 text-xs font-semibold tabular-nums text-slate-700">{detail}</p>
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100">
        {goodWidth > 0 ? (
          <div className={`h-full shrink-0 ${barClass}`} style={{ width: `${goodWidth}%` }} />
        ) : null}
        {defectWidth > 0 ? (
          <div className="h-full shrink-0 bg-rose-500" style={{ width: `${defectWidth}%` }} />
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
  tone: 'sky' | 'emerald'
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
        <MiniProgress percent={percent} defectPercent={defectPercent} tone={tone} detail={detail} />
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
        <MiniProgress percent={percent} defectPercent={defectPercent} tone={tone} detail={detail} />
      </button>
    </td>
  )
}

function stageDetail(produced: number, defected: number, target: number) {
  const base = `${produced.toLocaleString('ko-KR')} / ${target.toLocaleString('ko-KR')}`
  if (defected <= 0) return base
  return `${base} · 불량 ${defected.toLocaleString('ko-KR')}`
}

/** 생산(SMT·후공정) 목표가 있는 행만 진행 판정 대상 */
function hasProductionTarget(input: { smtTarget: number; postTarget: number }) {
  return input.smtTarget > 0 || input.postTarget > 0
}

/** 생산(SMT·후공정) 목표 대비 완료 여부 — 대상 없으면 false */
export function isProductionComplete(input: {
  smtTarget: number
  smtProduced: number
  postTarget: number
  postProduced: number
}) {
  const hasSmt = input.smtTarget > 0
  const hasPost = input.postTarget > 0
  if (!hasSmt && !hasPost) return false
  const smtDone = !hasSmt || input.smtProduced >= input.smtTarget
  const postDone = !hasPost || input.postProduced >= input.postTarget
  return smtDone && postDone
}

function ProductionLineStatusBadge({
  smtTarget,
  smtProduced,
  postTarget,
  postProduced,
}: {
  smtTarget: number
  smtProduced: number
  postTarget: number
  postProduced: number
}) {
  const base = ERP_BADGE_COMPACT_CLASS
  if (smtTarget <= 0 && postTarget <= 0) {
    return <span className={`${base} bg-slate-100 text-slate-500 ring-slate-200`}>대상없음</span>
  }
  if (isProductionComplete({ smtTarget, smtProduced, postTarget, postProduced })) {
    return (
      <span className={`${base} bg-emerald-50 text-emerald-700 ring-emerald-200`}>완료</span>
    )
  }
  return (
    <span className={`${base} bg-amber-50 text-amber-800 ring-amber-200`}>진행중</span>
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
  onSmtClick,
  onPostClick,
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
  onSmtClick?: () => void
  onPostClick?: () => void
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
    </>
  )
}

export function ProductionStatusTable({ lines, onStageClick }: ProductionStatusTableProps) {
  if (!lines.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState
          message="표시할 주문서가 없습니다"
          hint="주문서를 등록하면 생산 현황이 여기에 표시됩니다."
        />
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className="min-w-[860px] w-full border-collapse">
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
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                SMT
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                후공정
              </th>
              <th className="whitespace-nowrap px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
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
    const done = isProductionComplete(line)
    return (
      <tr className="border-t border-slate-200 bg-white hover:bg-slate-50/70">
        <td className="px-4 py-3.5 font-mono text-sm font-bold whitespace-nowrap text-slate-900" title={line.orderNumber}>
          {formatInternalCodeLabel(line.orderNumber)}
        </td>
        <td className={`px-4 py-3.5 text-sm font-semibold text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
          {line.customer || '—'}
        </td>
        <td className={`px-4 py-3.5 text-sm font-medium text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
          {line.productName || '—'}
        </td>
        <td className="whitespace-nowrap px-4 py-3">
          <DeliveryDueBadge deliveryDate={line.deliveryDate} done={done} />
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
          onSmtClick={onStageClick ? () => onStageClick(line, 'smt') : undefined}
          onPostClick={onStageClick ? () => onStageClick(line, 'post_process') : undefined}
        />
        <td className="whitespace-nowrap px-4 py-3.5">
          <ProductionLineStatusBadge
            smtTarget={line.smtTarget}
            smtProduced={line.smtProduced}
            postTarget={line.postTarget}
            postProduced={line.postProduced}
          />
        </td>
      </tr>
    )
  }

  return (
    <>
      {line.products.map((product) => {
        const done = isProductionComplete(product)
        return (
          <tr
            key={`${line.orderId}:${product.key}`}
            className="border-t border-slate-200 bg-white hover:bg-slate-50/70"
          >
            <td className="px-4 py-3.5 font-mono text-sm font-bold whitespace-nowrap text-slate-900" title={line.orderNumber}>
              {formatInternalCodeLabel(line.orderNumber)}
            </td>
            <td className={`px-4 py-3.5 text-sm font-semibold text-slate-800 ${ERP_TABLE_TD_WRAP_CLASS}`}>
              {line.customer || '—'}
            </td>
            <td className={`px-4 py-3.5 text-sm text-slate-900 ${ERP_TABLE_TD_WRAP_CLASS}`}>
              <span className="font-medium">{product.productName || '—'}</span>
              {product.productCode ? (
                <span className="ml-1.5 font-mono text-[11px] whitespace-nowrap text-slate-400">
                  [{product.productCode}]
                </span>
              ) : null}
            </td>
            <td className="whitespace-nowrap px-4 py-3">
              <DeliveryDueBadge deliveryDate={line.deliveryDate} done={done} />
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
            />
            <td className="px-4 py-3.5">
              <ProductionLineStatusBadge
                smtTarget={product.smtTarget}
                smtProduced={product.smtProduced}
                postTarget={product.postTarget}
                postProduced={product.postProduced}
              />
            </td>
          </tr>
        )
      })}
    </>
  )
}

/** 주문 내 생산 대상 제품이 모두 완료되면 true (대상없음 행은 무시) */
export function isProductionStatusLineComplete(line: ProductionStatusLine) {
  if (line.products.length > 0) {
    const targets = line.products.filter(hasProductionTarget)
    if (!targets.length) return isProductionComplete(line)
    return targets.every(isProductionComplete)
  }
  return isProductionComplete(line)
}

/**
 * 진행중/완료 필터용: 뱃지와 맞게 제품 행만 남긴다.
 * - 진행중: 미완료 생산 대상만
 * - 완료: 완료된 생산 대상만
 * - 대상없음 행은 진행중·완료에서 제외
 */
export function filterProductionStatusLineByStatus(
  line: ProductionStatusLine,
  statusFilter: 'active' | 'done' | 'all',
): ProductionStatusLine | null {
  if (statusFilter === 'all') return line

  if (line.products.length === 0) {
    if (!hasProductionTarget(line)) return null
    const done = isProductionComplete(line)
    if (statusFilter === 'done' ? done : !done) return line
    return null
  }

  const products = line.products.filter((product) => {
    if (!hasProductionTarget(product)) return false
    const done = isProductionComplete(product)
    return statusFilter === 'done' ? done : !done
  })
  if (!products.length) return null

  return {
    ...line,
    products,
    productCount: products.length,
    productName: products.map((product) => product.productName).filter(Boolean).join(', ') || line.productName,
  }
}
