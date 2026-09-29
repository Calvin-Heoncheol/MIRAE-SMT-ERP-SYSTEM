import type { ProductionOrderLine } from '@/lib/production-input/types'

export type MaterialManualOrderMetrics = {
  inboundSets: number
  outboundSets: number
  /** 출하 수량 환산 세트 — BOM 미등록 품목도 출하분은 입고·불출 완료로 간주 */
  shippedSets?: number
}

export type MaterialManualPageData = {
  orders: ProductionOrderLine[]
  metricsByLineId: Record<string, MaterialManualOrderMetrics>
}

export type FetchMaterialManualPageResult =
  | { ok: true; data: MaterialManualPageData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type MaterialManualSaveResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'auth' | 'validation'; detail: string }

export type MaterialManualHistoryKind = 'inbound' | 'outbound'

export type MaterialManualHistoryKindFilter = 'all' | MaterialManualHistoryKind

export type MaterialManualHistoryRow = {
  id: string
  kind: MaterialManualHistoryKind
  recordDate: string
  quantity: number
  createdAt: string
  createdByName: string
  orderId: string
  orderLineId: string
  orderNumber: string
  customerPoNumber: string
  customer: string
  productName: string
  productCode: string
}

export type FetchMaterialManualHistoryResult =
  | { ok: true; rows: MaterialManualHistoryRow[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }
