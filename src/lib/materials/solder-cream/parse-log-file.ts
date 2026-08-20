import type { SolderCreamEquipmentType, SolderCreamEventType, SolderCreamLogImportRow } from './types'
import {
  equipmentTxtLogSampleLines,
  isEquipmentTxtLogFormat,
  parseEquipmentTxtLog,
} from './parse-equipment-txt'

export const SOLDER_CREAM_LOG_COLUMNS = [
  { key: 'recordedAt', label: '기록시각', required: true },
  { key: 'equipmentType', label: '설비구분', required: false },
  { key: 'equipmentId', label: '설비ID', required: false },
  { key: 'lotNumber', label: 'LOT', required: true },
  { key: 'eventType', label: '이벤트', required: true },
  { key: 'temperature', label: '온도', required: false },
  { key: 'mixSeconds', label: '교반초', required: false },
  { key: 'result', label: '결과', required: false },
  { key: 'note', label: '비고', required: false },
] as const

const columnKeys = {
  recordedAt: true,
  equipmentType: true,
  equipmentId: true,
  lotNumber: true,
  eventType: true,
  temperature: true,
  mixSeconds: true,
  result: true,
  note: true,
} as const

const HEADER_ALIASES: Record<string, keyof typeof columnKeys> = {
  recorded_at: 'recordedAt',
  recordedat: 'recordedAt',
  timestamp: 'recordedAt',
  datetime: 'recordedAt',
  time: 'recordedAt',
  date: 'recordedAt',
  기록시각: 'recordedAt',
  시각: 'recordedAt',
  일시: 'recordedAt',
  equipment_type: 'equipmentType',
  equipmenttype: 'equipmentType',
  type: 'equipmentType',
  설비구분: 'equipmentType',
  설비: 'equipmentType',
  equipment_id: 'equipmentId',
  equipmentid: 'equipmentId',
  device: 'equipmentId',
  설비id: 'equipmentId',
  설비번호: 'equipmentId',
  lot_number: 'lotNumber',
  lotnumber: 'lotNumber',
  lot: 'lotNumber',
  lot번호: 'lotNumber',
  event_type: 'eventType',
  eventtype: 'eventType',
  event: 'eventType',
  이벤트: 'eventType',
  구분: 'eventType',
  상태: 'eventType',
  temperature: 'temperature',
  temp: 'temperature',
  온도: 'temperature',
  mix_seconds: 'mixSeconds',
  mixseconds: 'mixSeconds',
  mixtime: 'mixSeconds',
  stir_seconds: 'mixSeconds',
  교반초: 'mixSeconds',
  교반시간: 'mixSeconds',
  result: 'result',
  status: 'result',
  결과: 'result',
  note: 'note',
  memo: 'note',
  remark: 'note',
  remarks: 'note',
  비고: 'note',
}

function splitColumns(line: string) {
  if (line.includes('\t')) return line.split('\t')
  if (line.includes(',')) return line.split(',')
  return line.split(/\s{2,}/)
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '')
}

function mapHeader(value: string) {
  const key = normalizeHeader(value)
  return HEADER_ALIASES[key] ?? null
}

function parseNumber(value: string) {
  const trimmed = value.trim().replace(/,/g, '')
  if (!trimmed) return null
  const num = Number(trimmed)
  return Number.isFinite(num) ? num : null
}

function parseInteger(value: string) {
  const num = parseNumber(value)
  if (num == null) return null
  return Math.max(0, Math.floor(num))
}

function normalizeEquipmentType(value: string): SolderCreamEquipmentType {
  const raw = value.trim().toLowerCase()
  if (!raw) return 'unknown'
  if (/fridge|cold|refrigerator|냉장/.test(raw)) return 'fridge'
  if (/mix|mixer|stir|교반/.test(raw)) return 'mixer'
  return 'unknown'
}

function normalizeEventType(value: string): SolderCreamEventType {
  const raw = value.trim().toLowerCase()
  if (!raw) return 'unknown'
  if (/store|cold|냉장|입고|보관/.test(raw)) return 'store'
  if (/open|개봉/.test(raw)) return 'open'
  if (/mix_start|mixstart|stir_start|교반시작|교반 시작/.test(raw)) return 'mix_start'
  if (/mix_complete|mixcomplete|mix_end|mixend|stir_complete|교반완료|교반 완료|교반종료/.test(raw)) {
    return 'mix_complete'
  }
  if (/alarm|ng|fail|error|알람|이상/.test(raw)) return 'alarm'
  if (/discard|dispose|폐기|반납/.test(raw)) return 'discard'
  return 'unknown'
}

function parseRecordedAt(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return ''
  const match = trimmed.match(
    /^(\d{4})[.\/-](\d{2})[.\/-](\d{2})[ T](\d{2}:\d{2}:\d{2})(?:\.(\d+))?$/,
  )
  if (match) {
    const ms = (match[5] || '000').slice(0, 3).padEnd(3, '0')
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T${match[4]}.${ms}+09:00`)
    if (!Number.isNaN(date.getTime())) return date.toISOString()
  }
  const date = new Date(trimmed.replace(/\./g, '-').replace(/\//g, '-'))
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString()
}

export function solderCreamLogSampleRows() {
  return [
    ['2026-08-20 08:10:00', '냉장고', 'FR-01', 'MRL-250820-0001', '냉장입고', '5', '', 'OK', ''],
    ['2026-08-20 09:05:00', '교반기', 'MX-01', 'MRL-250820-0001', '교반완료', '', '180', 'OK', ''],
  ]
}

export function solderCreamEquipmentLogSampleText() {
  return equipmentTxtLogSampleLines()
}

export function solderCreamLogPlaceholder() {
  return equipmentTxtLogSampleLines()
}

export type ParseSolderCreamLogResult =
  | { ok: true; rows: SolderCreamLogImportRow[] }
  | { ok: false; detail: string }

export function parseSolderCreamLogText(text: string): ParseSolderCreamLogResult {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())

  if (!lines.length) {
    return { ok: false, detail: '파일 내용이 비어 있습니다.' }
  }

  if (isEquipmentTxtLogFormat(text)) {
    const rows = parseEquipmentTxtLog(text)
    if (!rows.length) {
      return {
        ok: false,
        detail: '설비 TXT에서 솔더페이스트 이벤트(입고·교반·출고 등)를 찾지 못했습니다.',
      }
    }
    return { ok: true, rows }
  }

  const firstCols = splitColumns(lines[0]).map((col) => col.trim())
  const headerMap = new Map<number, keyof typeof columnKeys>()
  let startIndex = 0

  for (let index = 0; index < firstCols.length; index += 1) {
    const mapped = mapHeader(firstCols[index] || '')
    if (mapped) headerMap.set(index, mapped)
  }

  if (headerMap.size >= 2) {
    startIndex = 1
  } else {
    headerMap.clear()
    headerMap.set(0, 'recordedAt')
    headerMap.set(1, 'equipmentType')
    headerMap.set(2, 'equipmentId')
    headerMap.set(3, 'lotNumber')
    headerMap.set(4, 'eventType')
    headerMap.set(5, 'temperature')
    headerMap.set(6, 'mixSeconds')
    headerMap.set(7, 'result')
    headerMap.set(8, 'note')
  }

  const rows: SolderCreamLogImportRow[] = []

  for (let lineIndex = startIndex; lineIndex < lines.length; lineIndex += 1) {
    const cols = splitColumns(lines[lineIndex]).map((col) => col.trim())
    if (!cols.some(Boolean)) continue

    const values: Partial<Record<keyof typeof columnKeys, string>> = {}
    for (const [index, key] of headerMap.entries()) {
      values[key] = cols[index] || ''
    }

    const recordedAt = parseRecordedAt(values.recordedAt || '')
    const lotNumber = (values.lotNumber || '').trim()
    const eventType = normalizeEventType(values.eventType || '')

    if (!recordedAt) {
      return {
        ok: false,
        detail: `${lineIndex + 1}행: 기록시각을 읽지 못했습니다.`,
      }
    }
    if (!lotNumber) {
      return { ok: false, detail: `${lineIndex + 1}행: LOT가 없습니다.` }
    }
    if (eventType === 'unknown') {
      return {
        ok: false,
        detail: `${lineIndex + 1}행: 이벤트 구분을 알 수 없습니다.`,
      }
    }

    rows.push({
      sourceRow: lineIndex + 1,
      recordedAt,
      equipmentType: normalizeEquipmentType(values.equipmentType || ''),
      equipmentId: (values.equipmentId || '').trim(),
      lotNumber,
      eventType,
      temperature: parseNumber(values.temperature || ''),
      mixSeconds: parseInteger(values.mixSeconds || ''),
      result: (values.result || '').trim(),
      note: (values.note || '').trim(),
    })
  }

  if (!rows.length) {
    return { ok: false, detail: '가져올 로그 행이 없습니다.' }
  }

  return { ok: true, rows }
}
