import type {
  SolderCreamEquipmentLog,
  SolderCreamEventType,
  SolderCreamLotStatus,
  SolderCreamLotStatusOverride,
  SolderCreamLotSummary,
  SolderCreamStatusRow,
} from './types'

export const SOLDER_CREAM_EQUIPMENT_LABELS = {
  fridge: '냉장고',
  mixer: '교반기',
  unknown: '—',
} as const

export const SOLDER_CREAM_EVENT_LABELS: Record<SolderCreamEventType, string> = {
  store: '냉장입고',
  open: '상온전환',
  mix_start: '교반시작',
  mix_complete: '교반완료',
  alarm: '알람',
  discard: '출고',
  unknown: '—',
}

export const SOLDER_CREAM_LOT_STATUS_LABELS: Record<SolderCreamLotStatus, string> = {
  cold: '냉장 보관중',
  discarded: '출고',
  scrapped: '폐기',
  unknown: '미확인',
}

export const SOLDER_CREAM_STATUS_FILTERS = ['all', 'cold', 'discarded', 'scrapped'] as const

export type SolderCreamStatusFilter = (typeof SOLDER_CREAM_STATUS_FILTERS)[number]

export function formatSolderCreamDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value || '—'
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

/** 퇴근 후 로그 기준 — 입고/출고만 보고 보관중·출고로 나눈다. */
export function deriveLotStatus(events: SolderCreamEquipmentLog[]): SolderCreamLotStatus {
  const relevant = events
    .filter((event) => event.eventType === 'store' || event.eventType === 'discard')
    .sort((a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime())

  const latest = relevant[relevant.length - 1]
  if (!latest) return 'unknown'
  return latest.eventType === 'discard' ? 'discarded' : 'cold'
}

export function formatSolderCreamDate(value: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

/** 설비 바코드 S-PF-260713-008#5 → 제조일(260713) */
export function parseManufactureDateFromBarcode(barcode: string): string | null {
  const match = barcode.match(/P[FB]-(\d{2})(\d{2})(\d{2})/i)
  if (!match) return null

  const year = 2000 + Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (month < 1 || month > 12 || day < 1 || day > 31) return null

  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** 냉장 보관 기본 유통기한 — 설비와 동일하게 제조일 + 180일 */
export function estimateExpiryDateFromManufacture(manufacturedAt: string | null) {
  if (!manufacturedAt) return null
  const match = manufacturedAt.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return null
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + 180))
  if (Number.isNaN(date.getTime())) return null
  return date.toISOString().slice(0, 10)
}

const STATUS_SORT_ORDER: Record<SolderCreamLotStatus, number> = {
  cold: 0,
  discarded: 1,
  scrapped: 2,
  unknown: 3,
}

export function buildSolderCreamStatusRows(
  logs: SolderCreamEquipmentLog[],
  overrides: SolderCreamLotStatusOverride[] = [],
): SolderCreamStatusRow[] {
  const map = new Map<string, SolderCreamEquipmentLog[]>()
  const overrideByLot = new Map(
    overrides.map((row) => [row.lotNumber.trim(), row] as const),
  )

  for (const log of logs) {
    const lot = log.lotNumber.trim()
    if (!lot || lot === 'SYSTEM') continue
    const list = map.get(lot) || []
    list.push(log)
    map.set(lot, list)
  }

  for (const override of overrides) {
    const lot = override.lotNumber.trim()
    if (!lot || map.has(lot)) continue
    map.set(lot, [])
  }

  return [...map.entries()]
    .map(([barcode, events]) => {
      const storeEvents = events.filter((event) => event.eventType === 'store')
      const latest = [...events].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      )[0]
      const manufacturedAt = parseManufactureDateFromBarcode(barcode)
      const derivedStatus = deriveLotStatus(events)
      const override = overrideByLot.get(barcode)
      const status = override?.status ?? derivedStatus

      return {
        barcode,
        manufacturedAt,
        expiresAt: estimateExpiryDateFromManufacture(manufacturedAt),
        lastEventAt: latest?.recordedAt ?? override?.updatedAt ?? null,
        inboundCount: storeEvents.length,
        status,
        derivedStatus,
        manualStatus: Boolean(override),
        note: override?.note || '',
      }
    })
    .filter((row) => row.status !== 'unknown')
    .sort((a, b) => {
      const statusDiff = STATUS_SORT_ORDER[a.status] - STATUS_SORT_ORDER[b.status]
      if (statusDiff !== 0) return statusDiff
      return (b.lastEventAt || '').localeCompare(a.lastEventAt || '')
    })
}

export function buildSolderCreamFridgeRows(
  logs: SolderCreamEquipmentLog[],
  overrides: SolderCreamLotStatusOverride[] = [],
): SolderCreamStatusRow[] {
  return buildSolderCreamStatusRows(logs, overrides).filter((row) => row.status === 'cold')
}

export function matchesSolderCreamFridgeSearch(row: SolderCreamStatusRow, query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [
    row.barcode,
    row.manufacturedAt,
    row.expiresAt,
    row.note,
    SOLDER_CREAM_LOT_STATUS_LABELS[row.status],
  ]
    .join(' ')
    .toLowerCase()
    .includes(q)
}

export function buildSolderCreamLotSummaries(logs: SolderCreamEquipmentLog[]): SolderCreamLotSummary[] {
  const map = new Map<string, SolderCreamEquipmentLog[]>()

  for (const log of logs) {
    const lot = log.lotNumber.trim()
    if (!lot) continue
    const list = map.get(lot) || []
    list.push(log)
    map.set(lot, list)
  }

  return [...map.entries()]
    .map(([lotNumber, events]) => {
      const sorted = [...events].sort(
        (a, b) => new Date(b.recordedAt).getTime() - new Date(a.recordedAt).getTime(),
      )
      const latest = sorted[0]
      return {
        lotNumber,
        status: deriveLotStatus(events),
        lastRecordedAt: latest.recordedAt,
        lastEventType: latest.eventType,
        lastTemperature: latest.temperature,
        lastMixSeconds: latest.mixSeconds,
        eventCount: events.length,
      }
    })
    .sort((a, b) => b.lastRecordedAt.localeCompare(a.lastRecordedAt))
}

export function isMissingSolderCreamLogTable(detail: string) {
  return (
    detail.includes('solder_cream_log_imports') ||
    detail.includes('solder_cream_equipment_logs') ||
    detail.includes('solder_cream_lot_status') ||
    detail.includes('schema cache') ||
    detail.includes('relationship')
  )
}

export function matchesSolderCreamSearch(
  log: SolderCreamEquipmentLog,
  query: string,
) {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [
    log.lotNumber,
    log.equipmentId,
    log.result,
    log.note,
    SOLDER_CREAM_EVENT_LABELS[log.eventType],
    SOLDER_CREAM_EQUIPMENT_LABELS[log.equipmentType],
  ]
    .join(' ')
    .toLowerCase()
    .includes(q)
}
