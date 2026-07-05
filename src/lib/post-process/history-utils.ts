export const POST_PROCESS_HISTORY_PAGE_SIZE = 20

export function filterPostProcessProductionHistory<T extends {
  orderNumber: string
  customer: string
  productName: string
  productCode: string
  recordDate: string
  note: string
}>(rows: T[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return rows

  return rows.filter((row) =>
    [row.orderNumber, row.customer, row.productName, row.productCode, row.recordDate, row.note]
      .join(' ')
      .toLowerCase()
      .includes(q),
  )
}

export function sumPostProcessHistoryQuantity<T extends { quantity: number }>(rows: T[]) {
  return rows.reduce((sum, row) => sum + Math.max(0, Math.floor(Number(row.quantity) || 0)), 0)
}

export function formatPostProcessHistoryDateTime(value: string) {
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

export function formatPostProcessProductionSourceLabel(source: string) {
  return source === 'manual' ? '수동' : source
}
