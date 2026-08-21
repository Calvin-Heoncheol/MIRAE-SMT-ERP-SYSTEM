import type {
  SolderCreamEquipmentType,
  SolderCreamEventType,
  SolderCreamLogImportRow,
} from './types'

/** 설비 LOT — S-PF-260713-008#5, T-PB-260714-033 등 */
export const EQUIPMENT_LOT_PATTERN = /[A-Z]-P[FB]-\d{6}(?:-\d+)?(?:#\d+)?/g

const EQUIPMENT_LINE_PATTERN = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?) (.+)$/

function parseEquipmentTimestamp(value: string) {
  const match = value.trim().match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?$/)
  if (!match) return ''
  const ms = (match[3] || '000').slice(0, 3).padEnd(3, '0')
  const date = new Date(`${match[1]}T${match[2]}.${ms}+09:00`)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

function extractLots(message: string) {
  const matches = message.match(EQUIPMENT_LOT_PATTERN)
  return matches ? [...new Set(matches)] : []
}

type ParsedEquipmentEvent = {
  eventType: SolderCreamEventType
  equipmentType: SolderCreamEquipmentType
  lotNumber: string
  mixSeconds: number | null
  result: string
  note: string
}

/** 지금은 입고(입고 완료)·출고(자재 출고)만 가져온다. */
function parseEquipmentMessage(message: string): ParsedEquipmentEvent[] {
  const trimmed = message.trim()
  if (!trimmed) return []

  const events: ParsedEquipmentEvent[] = []

  if (/입고\s*완료/.test(trimmed)) {
    for (const lot of extractLots(trimmed)) {
      events.push({
        eventType: 'store',
        equipmentType: 'fridge',
        lotNumber: lot,
        mixSeconds: null,
        result: 'OK',
        note: trimmed,
      })
    }
    return events
  }

  if (/자재\s*출고/.test(trimmed)) {
    for (const lot of extractLots(trimmed)) {
      events.push({
        eventType: 'discard',
        equipmentType: 'fridge',
        lotNumber: lot,
        mixSeconds: null,
        result: '출고',
        note: trimmed,
      })
    }
    return events
  }

  return events
}

const STORE_DEDUP_WINDOW_MS = 2 * 60 * 1000

function dedupeNearbyStoreEvents(rows: SolderCreamLogImportRow[]) {
  const kept: SolderCreamLogImportRow[] = []
  const lastStoreAtByLot = new Map<string, number>()

  for (const row of rows) {
    if (row.eventType !== 'store' || !row.lotNumber) {
      kept.push(row)
      continue
    }

    const recordedAt = new Date(row.recordedAt).getTime()
    const previousAt = lastStoreAtByLot.get(row.lotNumber)
    if (previousAt != null && Math.abs(recordedAt - previousAt) <= STORE_DEDUP_WINDOW_MS) {
      continue
    }

    lastStoreAtByLot.set(row.lotNumber, recordedAt)
    kept.push(row)
  }

  return kept
}

export function isEquipmentTxtLogFormat(text: string) {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)

  if (!lines.length) return false

  const matched = lines.filter((line) => EQUIPMENT_LINE_PATTERN.test(line)).length
  return matched >= 3 && matched / lines.length >= 0.5
}

export function parseEquipmentTxtLog(text: string): SolderCreamLogImportRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())

  const rows: SolderCreamLogImportRow[] = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const match = lines[lineIndex].match(EQUIPMENT_LINE_PATTERN)
    if (!match) continue

    const recordedAt = parseEquipmentTimestamp(match[1])
    const message = match[2]
    if (!recordedAt) continue

    for (const event of parseEquipmentMessage(message)) {
      rows.push({
        sourceRow: lineIndex + 1,
        recordedAt,
        equipmentType: event.equipmentType,
        equipmentId: '',
        lotNumber: event.lotNumber,
        eventType: event.eventType,
        temperature: null,
        mixSeconds: event.mixSeconds,
        result: event.result,
        note: event.note,
      })
    }
  }

  return dedupeNearbyStoreEvents(rows)
}

export function equipmentTxtLogSampleLines() {
  return `2026-08-20 14:58:05.131 입고 완료K-PF-260403-015
2026-08-19 08:41:25.128 자재 출고T-PB-260714-028#2`
}
