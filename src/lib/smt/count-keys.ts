import type { SmtPcbSide } from './types'
import { isSplitProductPcbSideMode } from '@/lib/products/utils'
import type { ProductPcbSideMode } from '@/lib/products/types'

export function buildSmtCountKey(orderLineId: string, pcbSide: SmtPcbSide) {
  return `${orderLineId}:${pcbSide}`
}

/** 계획 대비 실적 키 — 일자 · 주문라인 · 면 · SMT 라인 */
export function buildSmtPlanProgressKey(
  orderLineId: string,
  pcbSide: SmtPcbSide,
  lineNo: number,
  recordDate: string,
) {
  return `${recordDate}:${orderLineId}:${pcbSide}:${lineNo}`
}

export function defaultSmtPcbSideForMode(pcbSideMode: ProductPcbSideMode): SmtPcbSide {
  return isSplitProductPcbSideMode(pcbSideMode) ? 'TOP' : 'SINGLE'
}

export function smtPcbSidesForMode(pcbSideMode: ProductPcbSideMode): SmtPcbSide[] {
  return isSplitProductPcbSideMode(pcbSideMode) ? ['TOP', 'BOT'] : ['SINGLE']
}
