import { normalizeQuoteRates, type QuoteRates } from './constants'
import type { QuoteType } from './types'

export type QuoteRateField = {
  /** QuoteRateSet(국내/해외) 또는 QuoteRates 기준 경로 */
  path: string
  label: string
  unit: string
  /** 저장값은 비율(0.1), 화면은 % (10) */
  percent?: boolean
}

export type QuoteRateFieldGroup = {
  title: string
  fields: QuoteRateField[]
}

/** 국내/해외 단가 */
export const QUOTE_RATE_SET_GROUPS: QuoteRateFieldGroup[] = [
  {
    title: 'SMD 실장',
    fields: [
      { path: 'smt.chip', label: 'CHIP', unit: '원/개' },
      { path: 'smt.odd', label: '이형', unit: '원/개' },
      { path: 'smt.special', label: '특수모듈', unit: '원/개' },
      { path: 'smt.icPin', label: 'IC PIN', unit: '원/PIN' },
      { path: 'smt.bgaBall', label: 'BGA BALL', unit: '원/BALL' },
      { path: 'aoi', label: 'AOI 검사 (단면, 양면 2배)', unit: '원/PCB' },
    ],
  },
  {
    title: 'SET-UP',
    fields: [
      { path: 'setupRate', label: '장비 임율', unit: '원/분' },
      { path: 'setupBaseMinutesSingle', label: '기본시간 (단면)', unit: '분' },
      { path: 'setupBaseMinutesDouble', label: '기본시간 (양면·듀얼)', unit: '분' },
      { path: 'setupMinutesPerPart', label: 'SETTING', unit: '분/종' },
    ],
  },
  {
    title: '납땜',
    fields: [
      { path: 'dip.dipGeneral', label: '일반', unit: '원/개' },
      { path: 'dip.dipConnector', label: '커넥터', unit: '원/개' },
      { path: 'dip.dipWire', label: '전선', unit: '원/개' },
      { path: 'dip.dipXLarge', label: '초대형 (20PIN 이상)', unit: '원/개' },
    ],
  },
  {
    title: '후공정',
    fields: [{ path: 'postRate', label: '분당임률', unit: '원/분' }],
  },
]

/** 국내/해외 공통 */
export const QUOTE_RATE_COMMON_GROUPS: QuoteRateFieldGroup[] = [
  {
    title: 'SET-UP',
    fields: [{ path: 'firstArticleSecondsPerPart', label: '초품검사', unit: '초/종' }],
  },
  {
    title: '일회성 비용',
    fields: [
      { path: 'metalMaskSingle', label: '메탈마스크 (단면)', unit: '원/PCB' },
      { path: 'metalMaskDouble', label: '메탈마스크 (양면)', unit: '원/PCB' },
      { path: 'sampleCostSingle', label: '샘플 비용 (단면)', unit: '원' },
      { path: 'sampleCostDouble', label: '샘플 비용 (양면·듀얼)', unit: '원' },
      { path: 'sampleQtyThreshold', label: '샘플 비용 적용 (미만)', unit: '대' },
    ],
  },
  {
    title: '자재',
    fields: [{ path: 'materialManagementRate', label: '원자재 관리비', unit: '%', percent: true }],
  },
  {
    title: '후공정 시간 여유율',
    fields: [
      { path: 'postBuffer.under1000', label: '1,000대 미만', unit: '%', percent: true },
      { path: 'postBuffer.from1000', label: '1,000대 이상', unit: '%', percent: true },
      { path: 'postBuffer.from2000', label: '2,000대 이상', unit: '%', percent: true },
      { path: 'postBuffer.from5000', label: '5,000대 이상', unit: '%', percent: true },
    ],
  },
]

const QUOTE_TYPES: QuoteType[] = ['domestic', 'export']
const QUOTE_TYPE_LABEL: Record<QuoteType, string> = { domestic: '국내', export: '해외' }

function readPath(source: unknown, path: string): number {
  let current: unknown = source
  for (const key of path.split('.')) {
    current = current && typeof current === 'object' ? (current as Record<string, unknown>)[key] : undefined
  }
  return typeof current === 'number' ? current : 0
}

function writePath(target: Record<string, unknown>, path: string, value: number) {
  const keys = path.split('.')
  let current = target
  for (const key of keys.slice(0, -1)) {
    const next = current[key]
    if (!next || typeof next !== 'object') current[key] = {}
    current = current[key] as Record<string, unknown>
  }
  current[keys[keys.length - 1]] = value
}

function toDisplay(value: number, percent?: boolean) {
  return percent ? Math.round(value * 100 * 1000) / 1000 : value
}

/** 폼 키: 국내/해외 단가는 `domestic.smt.chip`, 공통은 `postBuffer.under1000` */
export function quoteRateFormKeys() {
  const keys: Array<{ key: string; field: QuoteRateField }> = []
  for (const type of QUOTE_TYPES) {
    for (const group of QUOTE_RATE_SET_GROUPS) {
      for (const field of group.fields) keys.push({ key: `${type}.${field.path}`, field })
    }
  }
  for (const group of QUOTE_RATE_COMMON_GROUPS) {
    for (const field of group.fields) keys.push({ key: field.path, field })
  }
  return keys
}

export type QuoteRateFormValues = Record<string, string>

export function quoteRatesToFormValues(rates: QuoteRates): QuoteRateFormValues {
  const values: QuoteRateFormValues = {}
  for (const { key, field } of quoteRateFormKeys()) {
    values[key] = String(toDisplay(readPath(rates, key), field.percent))
  }
  return values
}

export function formValuesToQuoteRates(
  values: QuoteRateFormValues,
): { ok: true; rates: QuoteRates } | { ok: false; error: string } {
  const raw: Record<string, unknown> = {}
  for (const { key, field } of quoteRateFormKeys()) {
    const text = String(values[key] ?? '').trim()
    const n = Number(text)
    if (!text || !Number.isFinite(n) || n < 0) {
      return { ok: false, error: `${formatQuoteRateKeyLabel(key)} 값을 0 이상의 숫자로 입력해 주세요.` }
    }
    writePath(raw, key, field.percent ? n / 100 : n)
  }
  return { ok: true, rates: normalizeQuoteRates(raw) }
}

export function formatQuoteRateKeyLabel(key: string) {
  const entry = quoteRateFormKeys().find((item) => item.key === key)
  if (!entry) return key
  const [first] = key.split('.')
  const typeLabel = first === 'domestic' || first === 'export' ? ` (${QUOTE_TYPE_LABEL[first]})` : ''
  return `${entry.field.label}${typeLabel}`
}

export function formatQuoteRateValue(value: number, field: QuoteRateField) {
  const display = toDisplay(value, field.percent)
  return `${display.toLocaleString('ko-KR', { maximumFractionDigits: 3 })}${field.percent ? '%' : ''}`
}

export type QuoteRateChange = {
  key: string
  label: string
  from: string
  to: string
}

export function diffQuoteRates(previous: QuoteRates, next: QuoteRates): QuoteRateChange[] {
  const changes: QuoteRateChange[] = []
  for (const { key, field } of quoteRateFormKeys()) {
    const before = readPath(previous, key)
    const after = readPath(next, key)
    if (before === after) continue
    changes.push({
      key,
      label: formatQuoteRateKeyLabel(key),
      from: formatQuoteRateValue(before, field),
      to: formatQuoteRateValue(after, field),
    })
  }
  return changes
}
