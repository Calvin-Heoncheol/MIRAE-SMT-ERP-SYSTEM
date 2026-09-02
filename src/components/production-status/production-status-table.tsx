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
  classifyProductionStatusProduct,
  classifyProductionStatusRow,
  isProductionStatusDeliveryComplete,
  isProductionStatusProductionComplete,
  type ProductionStatusBucket,
} from '@/lib/production-status/status-filter'
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
  tone: 'sky' | 'emerald' | 'amber'
  detail: string
}) {
  const barClass =
    tone === 'sky' ? 'bg-sky-500' : tone === 'emerald' ? 'bg-emerald-500' : 'bg-amber-500'
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
  clickTitle,
}: {
  percent: number
  defectPercent?: number
  tone: 'sky' | 'emerald' | 'amber'
  detail: string
  label: string
  empty?: boolean
  onClick?: () => void
  clickTitle?: string
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
        title={clickTitle ?? `${label} 총관리자 직접 입력`}
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

function deliveryDetail(produced: number, target: number) {
  return `${produced.toLocaleString('ko-KR')} / ${target.toLocaleString('ko-KR')}`
}

/** @deprecated status-filter 모듈 사용 */
export function isProductionComplete(input: {
  smtTarget: number
  smtProduced: number
  postTarget: number
  postProduced: number
}) {
  return isProductionStatusProductionComplete(input)
}

export function isProductProductionComplete(product: ProductionStatusProductLine) {
  return isProductionStatusProductionComplete(product)
}

const STATUS_BADGE_CLASS: Record<ProductionStatusBucket, string> = {
  producing: 'bg-amber-50 text-amber-800 ring-amber-200',
  production_done: 'bg-sky-50 text-sky-800 ring-sky-200',
  delivery_done: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  none: 'bg-slate-100 text-slate-500 ring-slate-200',
}

const STATUS_BADGE_LABEL: Record<ProductionStatusBucket, string> = {
  producing: '생산중',
  production_done: '생산완료',
  delivery_done: '출하완료',
  none: '대상없음',
}

function ProductionLineStatusBadge({
  product,
  line,
}: {
  product?: ProductionStatusProductLine
  line?: ProductionStatusLine
}) {
  const bucket = product
    ? classifyProductionStatusProduct(product)
    : line
      ? classifyProductionStatusRow({ ...line, smtChildrenCount: 0 })
      : 'none'
  const base = ERP_BADGE_COMPACT_CLASS
  return (
    <span className={`${base} ${STATUS_BADGE_CLASS[bucket]}`}>{STATUS_BADGE_LABEL[bucket]}</span>
  )
}

function isPipelineDueComplete(
  row: ProductionStatusLine | ProductionStatusProductLine,
) {
  if (row.deliveryTarget > 0) return isProductionStatusDeliveryComplete(row)
  return isProductionStatusProductionComplete(row)
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
        tone="amber"
        label="출하"
        empty={deliveryTarget <= 0}
        detail={deliveryDetail(deliveryProduced, deliveryTarget)}
        onClick={onDeliveryClick}
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
        <table className={`${ERP_TABLE_CLASS} min-w-[1100px]`}>
          <thead className={ERP_TABLE_HEAD_CLASS}>
            <tr>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>발주서</th>
              <th className={ERP_TABLE_TH_CLASS}>고객사</th>
              <th className={ERP_TABLE_TH_CLASS}>제품</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>버전</th>
              <th className={`${ERP_TABLE_TH_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>납기</th>
              <th className={ERP_TABLE_TH_CLASS}>SMT</th>
              <th className={ERP_TABLE_TH_CLASS}>후공정</th>
              <th className={ERP_TABLE_TH_CLASS}>출하</th>
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
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_WRAP_CLASS} font-medium text-slate-900`}>
          {line.productName || '—'}
        </td>
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS} text-center text-xs text-slate-500`}>
          —
        </td>
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
          <DeliveryDueBadge deliveryDate={line.deliveryDate} done={isPipelineDueComplete(line)} />
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
          onDeliveryClick={
            onStageClick && line.deliveryTarget > 0
              ? () => onStageClick(line, 'delivery')
              : undefined
          }
        />
        <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
          <ProductionLineStatusBadge line={line} />
        </td>
      </tr>
    )
  }

  return (
    <>
      {line.products.map((product) => {
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
              <DeliveryDueBadge deliveryDate={line.deliveryDate} done={isPipelineDueComplete(product)} />
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
            <td className={`${ERP_TABLE_TD_CLASS} ${ERP_TABLE_TD_FIXED_CLASS}`}>
              <ProductionLineStatusBadge product={product} />
            </td>
          </tr>
        )
      })}
    </>
  )
}

export { filterProductionStatusLineByStatus } from '@/lib/production-status/status-filter'
export { isProductionStatusLineProductionComplete as isProductionStatusLineComplete } from '@/lib/production-status/status-filter'
