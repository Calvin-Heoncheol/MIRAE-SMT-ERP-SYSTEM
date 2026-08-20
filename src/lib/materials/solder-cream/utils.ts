import type {
  SolderCreamEquipmentLog,
  SolderCreamEventType,
  SolderCreamLotStatus,
  SolderCreamLotSummary,
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
  ready: '사용 가능',
  mixed: '교반완료',
  opened: '개봉',
  cold: '냉장중',
  alarm: '알람',
  unknown: '미확인',
}

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

function deriveLotStatus(events: SolderCreamEquipmentLog[]): SolderCreamLotStatus {
  if (!events.length) return 'unknown'

  const sorted = [...events].sort(
    (a, b) => new Date(a.recordedAt).getTime() - new Date(b.recordedAt).getTime(),
  )
  const latest = sorted[sorted.length - 1]

  if (latest.eventType === 'alarm') return 'alarm'
  if (latest.eventType === 'discard') return 'unknown'

  if (latest.eventType === 'mix_complete') return 'ready'
  if (latest.eventType === 'mix_start') return 'mixed'
  if (latest.eventType === 'open') return 'opened'
  if (latest.eventType === 'store') return 'cold'

  const hasMixComplete = sorted.some((row) => row.eventType === 'mix_complete')
  const hasOpen = sorted.some((row) => row.eventType === 'open')
  const hasStore = sorted.some((row) => row.eventType === 'store')

  if (hasMixComplete) return 'ready'
  if (hasOpen) return 'opened'
  if (hasStore) return 'cold'
  return 'unknown'
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
