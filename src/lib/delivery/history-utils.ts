import { matchesDateRange, type DateRangeFilterValue } from '@/lib/ui/date-range'

export const DELIVERY_HISTORY_PAGE_SIZE = 20

export function filterDeliveryHistory<
  T extends {
    id: string
    orderNumber: string
    customer: string
    productName: string
    productCode: string
    recordDate: string
    note: string
  },
>(rows: T[], query: string, dateRange: DateRangeFilterValue = {}) {
  const q = query.trim().toLowerCase()

  return rows.filter((row) => {
    if (!matchesDateRange(row.recordDate, dateRange)) return false
    if (!q) return true
    return [row.id, row.orderNumber, row.customer, row.productName, row.productCode, row.recordDate, row.note]
      .join(' ')
      .toLowerCase()
      .includes(q)
  })
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
