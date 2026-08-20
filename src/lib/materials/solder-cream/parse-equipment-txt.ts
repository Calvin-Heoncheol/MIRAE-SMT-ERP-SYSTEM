import type {
  SolderCreamEquipmentType,
  SolderCreamEventType,
  SolderCreamLogImportRow,
} from './types'

/** 설비 LOT — S-PF-260713-008#5, T-PB-260714-033 등 */
export const EQUIPMENT_LOT_PATTERN = /[A-Z]-P[FB]-\d{6}(?:-\d+)?(?:#\d+)?/g

const EQUIPMENT_LINE_PATTERN = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+) (.+)$/

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

function extractFirstLot(message: string) {
  const match = message.match(/[A-Z]-P[FB]-\d{6}(?:-\d+)?(?:#\d+)?/)
  return match?.[0] || ''
}

function parseMixSeconds(message: string) {
  const match = message.match(/([\d.]+)\s*분\s*동안\s*교반/)
  if (!match) return null
  const minutes = Number(match[1])
  if (!Number.isFinite(minutes)) return null
  return Math.round(minutes * 60)
}

function parseMixRpm(message: string) {
  const match = message.match(/분당\s*([\d.]+)\s*회전/)
  if (!match) return null
  const rpm = Number(match[1])
  return Number.isFinite(rpm) ? rpm : null
}

type ParsedEquipmentEvent = {
  eventType: SolderCreamEventType
  equipmentType: SolderCreamEquipmentType
  lotNumber: string
  mixSeconds: number | null
  result: string
  note: string
}

function parseEquipmentMessage(message: string, activeMixLot: string | null): ParsedEquipmentEvent[] {
  const trimmed = message.trim()
  if (!trimmed) return []

  if (/^D:\\|^录制|^播放|^打开监控|^成功：|^关闭监控|^转动冷库|^Stop belt|^\d+$/.test(trimmed)) {
    return []
  }
  if (/경보|^错误：|^错误:/.test(trimmed)) {
    return [
      {
        eventType: 'alarm',
        equipmentType: 'unknown',
        lotNumber: extractFirstLot(trimmed) || activeMixLot || 'SYSTEM',
        mixSeconds: null,
        result: 'NG',
        note: trimmed,
      },
    ]
  }

  const events: ParsedEquipmentEvent[] = []

  if (/자재\s*입고|입고\s*완료/.test(trimmed)) {
    for (const lot of extractLots(trimmed)) {
      events.push({
        eventType: 'store',
        equipmentType: 'fridge',
        lotNumber: lot,
        mixSeconds: null,
        result: /완료/.test(trimmed) ? 'OK' : '',
        note: trimmed,
      })
    }
    return events
  }

  if (/냉장\s*보관실에서\s*자재\s*꺼내기/.test(trimmed)) {
    for (const lot of extractLots(trimmed)) {
      events.push({
        eventType: 'open',
        equipmentType: 'fridge',
        lotNumber: lot,
        mixSeconds: null,
        result: '',
        note: trimmed,
      })
    }
    return events
  }

  if (/상온\s*보관실에서\s*자재\s*꺼내기/.test(trimmed)) {
    for (const lot of extractLots(trimmed)) {
      events.push({
        eventType: 'open',
        equipmentType: 'fridge',
        lotNumber: lot,
        mixSeconds: null,
        result: '',
        note: trimmed,
      })
    }
    return events
  }

  if (/을\s*상온\s*보관실에\s*넣/.test(trimmed)) {
    for (const lot of extractLots(trimmed)) {
      events.push({
        eventType: 'open',
        equipmentType: 'fridge',
        lotNumber: lot,
        mixSeconds: null,
        result: 'OK',
        note: trimmed,
      })
    }
    return events
  }

  if (/자재를\s*교반통에\s*넣습니다/.test(trimmed)) {
    const lot = extractFirstLot(trimmed) || activeMixLot || ''
    if (lot) {
      events.push({
        eventType: 'mix_start',
        equipmentType: 'mixer',
        lotNumber: lot,
        mixSeconds: null,
        result: '',
        note: trimmed,
      })
    }
    return events
  }

  if (/분당\s*[\d.]+\s*회전\s*속도로\s*[\d.]+\s*분\s*동안\s*교반/.test(trimmed)) {
    const lot = activeMixLot || ''
    if (lot) {
      events.push({
        eventType: 'mix_start',
        equipmentType: 'mixer',
        lotNumber: lot,
        mixSeconds: parseMixSeconds(trimmed),
        result: `RPM ${parseMixRpm(trimmed) ?? '—'}`,
        note: trimmed,
      })
    }
    return events
  }

  if (trimmed === '교반 완료') {
    const lot = activeMixLot || ''
    if (lot) {
      events.push({
        eventType: 'mix_complete',
        equipmentType: 'mixer',
        lotNumber: lot,
        mixSeconds: null,
        result: 'OK',
        note: trimmed,
      })
    }
    return events
  }

  if (/교반기\d+에서\s*제품/.test(trimmed) && /꺼내기\s*성공/.test(trimmed)) {
    for (const lot of extractLots(trimmed)) {
      if (lot === 'RT') continue
      events.push({
        eventType: 'mix_complete',
        equipmentType: 'mixer',
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
        equipmentType: 'unknown',
        lotNumber: lot,
        mixSeconds: null,
        result: '출고',
        note: trimmed,
      })
    }
    return events
  }

  if (/WaitOutbound/.test(trimmed)) {
    const lot = activeMixLot || ''
    if (lot) {
      events.push({
        eventType: 'mix_complete',
        equipmentType: 'mixer',
        lotNumber: lot,
        mixSeconds: null,
        result: 'WaitOutbound',
        note: trimmed,
      })
    }
    return events
  }

  return events
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
  let activeMixLot: string | null = null

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const match = lines[lineIndex].match(EQUIPMENT_LINE_PATTERN)
    if (!match) continue

    const recordedAt = parseEquipmentTimestamp(match[1])
    const message = match[2]
    if (!recordedAt) continue

    const parsedEvents = parseEquipmentMessage(message, activeMixLot)
    for (const event of parsedEvents) {
      if (event.eventType === 'mix_start' && event.lotNumber) {
        activeMixLot = event.lotNumber
      }
      if (event.eventType === 'mix_complete') {
        activeMixLot = null
      }

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

    if (/상온\s*보관실에서\s*자재\s*꺼내기/.test(message)) {
      const lot = extractFirstLot(message)
      if (lot) activeMixLot = lot
    }
  }

  return rows
}

export function equipmentTxtLogSampleLines() {
  return `2026-08-19 19:11:30.117 자재 입고K-PF-260403-016
2026-08-19 19:11:42.206 입고 완료K-PF-260403-016
2026-08-19 05:05:55.150 냉장 보관실에서 자재 꺼내기S-PF-260713-008#5
2026-08-19 07:06:18.246 자재를 교반통에 넣습니다S-PF-260713-008#5
2026-08-19 07:06:55.578 분당 800.00회전 속도로 4.00분 동안 교반합니다
2026-08-19 07:11:45.066 교반 완료
2026-08-19 08:41:25.128 자재 출고T-PB-260714-028#2`
}
