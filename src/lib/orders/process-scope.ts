import { deriveItemProcessType } from '@/lib/items/types'

/** 발주 라인 이번 작업 공정 범위 */
export type OrderProcessType = 'smt' | 'post' | 'smt_post'

export const ORDER_PROCESS_TYPES: OrderProcessType[] = ['smt', 'post', 'smt_post']

export const ORDER_PROCESS_TYPE_LABELS: Record<OrderProcessType, string> = {
  smt: 'SMD',
  post: '후공정',
  smt_post: 'SMD+후공정',
}

export function normalizeOrderProcessType(value: unknown): OrderProcessType | '' {
  const raw = String(value || '').trim()
  if (raw === 'smt' || raw === 'post' || raw === 'smt_post') return raw
  return ''
}

/** 저장된 단가 구성으로 공정 범위 추정 (컬럼 없을 때·레거시) */
export function inferOrderProcessTypeFromPrices(input: {
  setupCost?: number
  smdUnitPrice?: number
  dipUnitPrice?: number
}): OrderProcessType {
  const setup = Math.max(0, Math.round(Number(input.setupCost) || 0))
  const smd = Math.max(0, Math.round(Number(input.smdUnitPrice) || 0))
  const dip = Math.max(0, Math.round(Number(input.dipUnitPrice) || 0))
  const hasSmd = smd > 0 || setup > 0
  const hasPost = dip > 0
  if (hasSmd && hasPost) return 'smt_post'
  if (hasSmd) return 'smt'
  if (hasPost) return 'post'
  return 'smt_post'
}

/**
 * 발주 라인 공정 범위 결정.
 * 1) 라인에 저장된 값 → 2) 품목 공정 → 3) 단가 유도 → 4) SMD+후공정
 */
export function resolveOrderProcessType(input: {
  processType?: string | null
  productProcessType?: string | null
  setupCost?: number
  smdUnitPrice?: number
  dipUnitPrice?: number
}): OrderProcessType {
  const fromLine = normalizeOrderProcessType(input.processType)
  if (fromLine) return fromLine

  const fromProduct = normalizeOrderProcessType(input.productProcessType)
  if (fromProduct) return fromProduct

  const derived = deriveItemProcessType(
    Math.max(0, Math.round(Number(input.smdUnitPrice) || 0)),
    Math.max(0, Math.round(Number(input.dipUnitPrice) || 0)),
  )
  const fromDerived = normalizeOrderProcessType(derived)
  if (fromDerived) return fromDerived

  return inferOrderProcessTypeFromPrices(input)
}

/** 품목 표준단가에서 이번 공정 범위만 남긴다 (자재는 공통 포함) */
export function scopeOrderLinePrices(input: {
  processType: OrderProcessType
  setupCost: number
  smdUnitPrice: number
  dipUnitPrice: number
  materialUnitPrice: number
}) {
  const setupCost = Math.max(0, Math.round(Number(input.setupCost) || 0))
  const smdUnitPrice = Math.max(0, Math.round(Number(input.smdUnitPrice) || 0))
  const dipUnitPrice = Math.max(0, Math.round(Number(input.dipUnitPrice) || 0))
  const materialUnitPrice = Math.max(0, Math.round(Number(input.materialUnitPrice) || 0))

  if (input.processType === 'smt') {
    return { setupCost, smdUnitPrice, dipUnitPrice: 0, materialUnitPrice }
  }
  if (input.processType === 'post') {
    return { setupCost: 0, smdUnitPrice: 0, dipUnitPrice, materialUnitPrice }
  }
  return { setupCost, smdUnitPrice, dipUnitPrice, materialUnitPrice }
}
