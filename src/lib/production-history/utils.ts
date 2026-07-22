import { formatSmtPcbSideLabel } from '@/lib/smt/history-utils'
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

export function filterProductionHistory(
  rows: ProductionHistoryRow[],
  query: string,
  teamFilter: ProductionHistoryTeamFilter,
) {
  const q = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (teamFilter !== 'all' && row.team !== teamFilter) return false
    if (!q) return true

    const haystack = [
      row.team,
      row.recordDate,
      row.orderNumber,
      row.customer,
      row.productName,
      row.productCode,
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
