import { matchesDateRange, type DateRangeFilterValue } from '@/lib/ui/date-range'
import type { DeliveryHistoryRow } from '@/lib/delivery/types'
import type { SalesReportStatementGroup } from '@/lib/reports/sales-report'
import {
  buildShipmentStatementLinesFromHistory,
  type DeliveryBillingOnlyLine,
} from '@/lib/delivery/utils'

export const DELIVERY_HISTORY_PAGE_SIZE = 20

export type DeliveryHistoryShipmentGroup = {
  shipmentId: string
  recordDate: string
  customer: string
  productName: string
  quantity: number
  /** 명세서 기준 공급가액 합계 (추가작업 포함) */
  supplyAmount?: number | null
  lines: DeliveryHistoryRow[]
}

/** 출하등록 목록 — ERP 출하 + 과거 거래명세서 */
export type DeliveryStatementTableGroup = DeliveryHistoryShipmentGroup & {
  source: 'delivery' | 'legacy'
  legacyGroup?: SalesReportStatementGroup
}

export function statementTableRowKey(group: Pick<DeliveryStatementTableGroup, 'source' | 'shipmentId'>) {
  return `${group.source}:${group.shipmentId}`
}

export function legacyStatementGroupToTableGroup(
  group: SalesReportStatementGroup,
): DeliveryStatementTableGroup {
  return {
    shipmentId: group.shipmentId,
    recordDate: group.recordDate,
    customer: group.customer,
    productName: group.productName,
    quantity: group.quantity,
    supplyAmount: group.amount,
    lines: [],
    source: 'legacy',
    legacyGroup: group,
  }
}

export function filterStatementTableGroups(
  groups: DeliveryStatementTableGroup[],
  query: string,
  dateRange: DateRangeFilterValue = {},
) {
  const q = query.trim().toLowerCase()
  return groups.filter((group) => {
    if (!matchesDateRange(group.recordDate, dateRange)) return false
    if (!q) return true
    return [group.shipmentId, group.customer, group.productName, group.recordDate]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
}

export function filterDeliveryHistory<
  T extends {
    id: string
    shipmentId?: string
    orderNumber: string
    customerPoNumber?: string
    customer: string
    productName: string
    productCode: string
    recordDate: string
    note: string
    lotLabel?: string
  },
>(rows: T[], query: string, dateRange: DateRangeFilterValue = {}) {
  const q = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (!matchesDateRange(row.recordDate, dateRange)) return false
    if (!q) return true
    return [
      row.id,
      row.shipmentId,
      row.orderNumber,
      row.customerPoNumber,
      row.customer,
      row.productName,
      row.productCode,
      row.recordDate,
      row.note,
      row.lotLabel,
    ]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
}

/** 같은 출하번호(shipmentId)를 한 행으로 묶음 */
export function groupDeliveryHistoryByShipment(
  rows: DeliveryHistoryRow[],
): DeliveryHistoryShipmentGroup[] {
  const groups = new Map<string, DeliveryHistoryRow[]>()
  for (const row of rows) {
    const key = String(row.shipmentId || row.id || '').trim()
    if (!key) continue
    const list = groups.get(key) || []
    list.push(row)
    groups.set(key, list)
  }

  const result: DeliveryHistoryShipmentGroup[] = []
  for (const [shipmentId, lines] of groups) {
    const sorted = [...lines].sort((a, b) => {
      const byDate = b.recordDate.localeCompare(a.recordDate)
      if (byDate !== 0) return byDate
      return String(b.id).localeCompare(String(a.id))
    })
    const first = sorted[0]!
    const recordDate = sorted.reduce(
      (latest, line) => (line.recordDate > latest ? line.recordDate : latest),
      first.recordDate,
    )
    const productNames = [
      ...new Set(sorted.map((line) => line.productName.trim()).filter(Boolean)),
    ]
    result.push({
      shipmentId,
      recordDate,
      customer: first.customer,
      productName:
        productNames.length <= 1
          ? productNames[0] || ''
          : `${productNames[0]} 외 ${productNames.length - 1}건`,
      quantity: sorted.reduce(
        (sum, line) => sum + Math.max(0, Math.floor(Number(line.quantity) || 0)),
        0,
      ),
      lines: sorted,
    })
  }

  return result.sort((a, b) => {
    const byDate = b.recordDate.localeCompare(a.recordDate)
    if (byDate !== 0) return byDate
    return b.shipmentId.localeCompare(a.shipmentId)
  })
}

/** 출하 이력 묶음의 거래명세서 공급가액 (제품 + 추가작업) */
export function computeShipmentGroupSupplyAmount(
  group: Pick<DeliveryHistoryShipmentGroup, 'lines'>,
  input: {
    unitPriceByDeliveryId: Record<string, number>
    billingOnlyLines: DeliveryBillingOnlyLine[]
    productionOrders: Array<{
      assemblyGroupId?: string
      orderNumber: string
      productId?: string
      productCode: string
      productName: string
      unitPrice: number
    }>
  },
): number {
  const statementLines = buildShipmentStatementLinesFromHistory({
    lines: group.lines.map((line) => ({
      id: line.id,
      orderNumber: line.orderNumber,
      assemblyGroupId: line.assemblyGroupId,
      productId: line.productId,
      productCode: line.productCode,
      productName: line.productName,
      quantity: line.quantity,
    })),
    unitPriceByDeliveryId: input.unitPriceByDeliveryId,
    billingOnlyLines: input.billingOnlyLines,
    productionOrders: input.productionOrders,
  })

  return statementLines.reduce((sum, line) => {
    const qty = Math.max(0, Math.floor(Number(line.qty) || 0))
    const price = Math.max(0, Math.round(Number(line.unitPrice) || 0))
    return sum + qty * price
  }, 0)
}

export function sumDeliveryHistoryQuantity<T extends { quantity: number }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.quantity) || 0)), 0)
}

export function formatDeliveryHistoryDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    timeZone: 'Asia/Seoul',
  }).format(date)
}

export function formatDeliverySourceLabel(source: string) {
  return source === 'manual' ? '수동' : source
}

/** 조립그룹별 출하 차수 라벨 (1 → 1차) */
export function formatShipmentRound(round: number) {
  const n = Math.max(0, Math.floor(Number(round) || 0))
  if (n < 1) return '—'
  return `${n}차`
}

/**
 * 같은 조립그룹 안에서는 created_at → recordDate → id 오름차순으로 1차, 2차…
 * (목록은 최신순이어도 차수는 등록 순서를 유지)
 */
export function assignShipmentRounds<
  T extends { id: string; assemblyGroupId: string; createdAt: string; recordDate: string },
>(rows: T[]): Array<T & { shipmentRound: number }> {
  const byGroup = new Map<string, T[]>()
  for (const row of rows) {
    const key = String(row.assemblyGroupId || '').trim() || '__none__'
    const list = byGroup.get(key) ?? []
    list.push(row)
    byGroup.set(key, list)
  }

  const roundById = new Map<string, number>()
  for (const list of byGroup.values()) {
    const sorted = [...list].sort((a, b) => {
      const byCreated = String(a.createdAt || '').localeCompare(String(b.createdAt || ''))
      if (byCreated !== 0) return byCreated
      const byDate = String(a.recordDate || '').localeCompare(String(b.recordDate || ''))
      if (byDate !== 0) return byDate
      return String(a.id || '').localeCompare(String(b.id || ''))
    })
    sorted.forEach((row, index) => {
      roundById.set(row.id, index + 1)
    })
  }

  return rows.map((row) => ({
    ...row,
    shipmentRound: roundById.get(row.id) ?? 1,
  }))
}
