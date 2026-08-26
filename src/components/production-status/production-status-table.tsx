'use client'

import { DeliveryDueBadge } from '@/components/ui/delivery-due-badge'
import { EmptyListState } from '@/components/ui/empty-list-state'
import { displayOrderPoNumber } from '@/lib/orders/utils'
import type {
  ProductionStatusLine,
  ProductionStatusProductLine,
  ProductionStatusStage,
} from '@/lib/production-status/types'
import {
  ERP_BADGE_COMPACT_CLASS,
  ERP_TABLE_CLASS,
  ERP_TABLE_HEAD_CLASS,
  ERP_TABLE_ROW_CLASS,
  ERP_TABLE_SCROLL_CLASS,
  ERP_TABLE_TD_CLASS,
  ERP_TABLE_TD_FIXED_CLASS,
  ERP_TABLE_TD_WRAP_CLASS,
  ERP_TABLE_TH_CLASS,
  ERP_TABLE_WRAP_CLASS,
} from '@/lib/ui/tokens'

type ProductionStatusTableProps = {
  lines: ProductionStatusLine[]
  emptyMessage?: string
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
      <td className={ERP_TABLE_TD_CLASS}>
        <span className="text-xs text-slate-400">없음</span>
      </td>
    )
  }

  if (!onClick) {
    return (
      <td className={ERP_TABLE_TD_CLASS}>
        <MiniProgress percent={percent} defectPercent={defectPercent} tone={tone} detail={detail} />
      </td>
    )
  }

  return (
    <td className={ERP_TABLE_TD_CLASS}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onClick()
        }}
        title={`${label} 총관리자 직접 입력`}
        className="w-full rounded-lg px-1 py-0.5 text-left transition hover:bg-amber-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
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

export function isProductProductionComplete(product: ProductionStatusProductLine) {
  return isProductionComplete(product)
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

export function ProductionStatusTable({ lines, emptyMessage, onStageClick }: ProductionStatusTableProps) {
  if (!lines.length) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <EmptyListState message={emptyMessage ?? '표시할 발주서가 없습니다'} />
      </div>
    )
  }

  return (
    <div className={ERP_TABLE_WRAP_CLASS}>
      <div className={ERP_TABLE_SCROLL_CLASS}>
        <table className={`${ERP_TABLE_CLASS} min-w-[980px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>발주서</th>
              <th className={ERP_TABLE_TH_CLASS}>고객사</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>품목코드</th>
              <th className={ERP_TABLE_TH_CLASS}>제품</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>버전</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>납기</th>
              <th className={ERP_TABLE_TH_CLASS}>SMT</th>
              <th className={ERP_TABLE_TH_CLASS}>후공정</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>상태</th>
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
      <tr className={ERP_TABLE_ROW_CLASS}>
        <td
          className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-sm font-bold text-slate-900`}
          title={displayOrderPoNumber(line.customerPoNumber, line.orderNumber)}
        >
          {displayOrderPoNumber(line.customerPoNumber, line.orderNumber) || '—'}
        </td>
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-semibold text-slate-800`}>
          {line.customer || '—'}
        </td>
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-xs text-slate-700`}>—</td>
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-medium text-slate-900`}>
          {line.productName || '—'}
        </td>
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center text-xs text-slate-500`}>
          —
        </td>
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
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
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
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
        const done = isProductProductionComplete(product)
        return (
          <tr key={`${line.orderId}:${product.key}`} className={ERP_TABLE_ROW_CLASS}>
            <td
              className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-sm font-bold text-slate-900`}
              title={displayOrderPoNumber(line.customerPoNumber, line.orderNumber)}
            >
              {displayOrderPoNumber(line.customerPoNumber, line.orderNumber) || '—'}
            </td>
            <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-semibold text-slate-800`}>
              {line.customer || '—'}
            </td>
            <td
              className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} font-mono text-xs text-slate-700`}
              title={product.productCode || undefined}
            >
              {product.productCode || '—'}
            </td>
            <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-medium text-slate-900`}>
              {product.productName || '—'}
            </td>
            <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center`}>
              {product.version ? (
                <span className="text-xs font-semibold text-sky-700">{product.version}</span>
              ) : (
                <span className="text-xs text-slate-300">—</span>
              )}
            </td>
            <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
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
            <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
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
    const targets = line.products.filter(
      (product) => hasProductionTarget(product) || product.smtChildren.length > 0,
    )
    if (!targets.length) return isProductionComplete(line)
    return targets.every(isProductProductionComplete)
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
    if (!hasProductionTarget(product) && product.smtChildren.length === 0) return false
    const done = isProductProductionComplete(product)
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
