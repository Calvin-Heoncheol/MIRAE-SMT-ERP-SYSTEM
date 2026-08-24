export type DeliverySource = 'manual'

export type DeliveryRecord = {
  id: string
  /** 거래명세서 묶음번호 — 같은 값이면 한 장 */
  shipmentId: string
  recordDate: string
  assemblyGroupId: string
  quantity: number
  source: DeliverySource
  note: string
  createdBy?: string | null
  createdByName: string
  createdAt: string
}

export type CreateDeliveryRecordInput = {
  assemblyGroupId: string
  quantity: number
  /** 비어 있으면 MRS-YYMMDD-NN 자동 발급 (라인 id) */
  shipmentNumber?: string
  /** 명세서 묶음번호 — 비우면 라인 id 와 동일 */
  shipmentGroupId?: string
  recordDate?: string
  source?: DeliverySource
  note?: string
  /** 비우면 출하 시 FIFO 자동 배정 */
  allocations?: Array<{ lotId: string; lotDate?: string; quantity: number; remaining?: number }>
}

export type CreateDeliveryShipmentLineInput = {
  assemblyGroupId: string
  quantity: number
  allocations?: Array<{ lotId: string; lotDate?: string; quantity: number; remaining?: number }>
}

export type CreateDeliveryShipmentInput = {
  customer: string
  recordDate?: string
  note?: string
  lines: CreateDeliveryShipmentLineInput[]
}

export type UpdateDeliveryRecordInput = {
  recordDate?: string
  quantity?: number
  note?: string
}

export type DeliveryHistoryRow = {
  id: string
  shipmentId: string
  assemblyGroupId: string
  recordDate: string
  createdAt: string
  /** 내부 발주ID (MRO-…) */
  orderNumber: string
  /** 고객 발주번호(PO) — 화면 표시용 */
  customerPoNumber: string
  customer: string
  productName: string
  productCode: string
  targetQuantity: number
  quantity: number
  /** 동일 조립그룹 기준 출하 차수 (1차, 2차…) */
  shipmentRound: number
  source: DeliverySource
  note: string
  createdBy?: string | null
  createdByName: string
  /** 출하에 배정된 생산 LOT (없으면 빈 문자열) */
  lotLabel: string
}

export type DeliveryStatementLine = {
  orderNumber?: string
  productCode: string
  productName: string
  qty: number
  unitPrice: number
  supplyAmount: number
}

export type DeliveryStatementData = {
  docNo: string
  shipDate: string
  /** 대표 발주ID (혼합 출하는 품목 행에 각각 표시) */
  orderNumber: string
  customer: string
  /** 거래처 마스터 사업장 주소 */
  customerAddress?: string
  /** 거래처 마스터 전화 */
  customerPhone?: string
  note: string
  /** 이번 출하(명세) 품목 */
  items: DeliveryStatementLine[]
}

/** 출하목록 라인 */
export type DeliveryCartLine = {
  key: string
  uiKey: string
  assemblyGroupId: string
  orderNumber: string
  customerPoNumber: string
  customer: string
  productCode: string
  productName: string
  productVersion: string | null
  unitPrice: number
  quantity: number
  maxQuantity: number
}
