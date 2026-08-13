import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
import { matchesDateRange, type DateRangeFilterValue } from '@/lib/ui/date-range'
import type {
  ProductionHistoryRow,
  ProductionHistoryTeamFilter,
} from './types'

export function formatProductionHistoryDateTime(iso: string) {
  if (!iso) return '-'
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '-'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

/** 기록일 표시 — 등록 시각(createdAt)이 있으면 날짜+시간, 없으면 기록일 */
export function formatProductionHistoryRecordAt(
  row: Pick<ProductionHistoryRow, 'recordDate' | 'createdAt'>,
) {
  const withTime = formatProductionHistoryDateTime(row.createdAt)
  if (withTime !== '-') return withTime
  return row.recordDate.trim() || '-'
}

export type ProductionHistoryDateRange = DateRangeFilterValue

export function filterProductionHistory(
  rows: ProductionHistoryRow[],
  query: string,
  teamFilter: ProductionHistoryTeamFilter,
  dateRange: ProductionHistoryDateRange = {},
) {
  const q = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (teamFilter !== 'all' && row.team !== teamFilter) return false
    if (!matchesDateRange(row.recordDate, dateRange)) return false
    if (!q) return true

    const haystack = [
      row.team,
      row.recordDate,
      formatProductionHistoryRecordAt(row),
      row.orderNumber,
      row.customer,
      row.productName,
      row.productCode,
      row.lotLabel,
      row.shipmentLabel,
      row.createdByName,
      row.note,
      row.lineNo != null ? `라인${row.lineNo}` : '',
      row.pcbSide ? formatSmtPcbSideLabel(row.pcbSide) : '',
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function sumProductionHistoryQuantity(rows: ProductionHistoryRow[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.quantity) || 0)), 0)
}
