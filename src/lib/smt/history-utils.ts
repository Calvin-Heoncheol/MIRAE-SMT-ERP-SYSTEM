import type { SmtPcbSide, SmtProductionHistoryRow, SmtProductionSource } from './types'

export const SMT_HISTORY_PAGE_SIZE = 20

export function formatSmtPcbSideLabel(pcbSide: SmtPcbSide) {
  if (pcbSide === 'TOP') return 'TOP'
  if (pcbSide === 'BOT') return 'BOT'
  return '-'
}

export function formatSmtProductionSourceLabel(source: SmtProductionSource) {
  if (source === 'line_sync') return '라인동기화'
  return '생산입력'
}

export function formatSmtHistoryDateTime(iso: string) {
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

export function filterSmtProductionHistory(rows: SmtProductionHistoryRow[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return rows

  return rows.filter((row) => {
    const haystack = [
      row.recordDate,
      row.orderNumber,
      row.customer,
      row.productName,
      row.productCode,
      row.note,
      row.lineNo != null ? `라인${row.lineNo}` : '',
      formatSmtPcbSideLabel(row.pcbSide),
      formatSmtProductionSourceLabel(row.source),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}

export function sumSmtHistoryQuantity(rows: SmtProductionHistoryRow[]) {
  return rows.reduce((sum, row) => sum + row.quantity, 0)
}
