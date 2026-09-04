import { todayYmdSeoul } from '@/lib/orders/utils'

/**
 * 고객사 → 작업번호/레거시 코드 접두사.
 * 거래처 `code_prefix`가 있으면 그걸 우선하고, 없을 때 이 매핑·자동 로마자를 사용.
 */

const CHO = [
  'g',
  'kk',
  'n',
  'd',
  'tt',
  'r',
  'm',
  'b',
  'pp',
  's',
  'ss',
  '',
  'j',
  'jj',
  'ch',
  'k',
  't',
  'p',
  'h',
] as const

const JUNG = [
  'a',
  'ae',
  'ya',
  'yae',
  'eo',
  'e',
  'yeo',
  'ye',
  'o',
  'wa',
  'wae',
  'oe',
  'yo',
  'u',
  'wo',
  'we',
  'wi',
  'yu',
  'eu',
  'ui',
  'i',
] as const

const FALLBACK_ORDER_PREFIX = 'MRO'

/** 한글 상호 → 관용 영문 접두 (자동 로마자보다 우선) */
const CUSTOMER_CODE_PREFIX_OVERRIDES: Array<{ match: string; prefix: string }> = [
  { match: '리텍', prefix: 'LEE' },
  { match: '파스텍', prefix: 'FAS' },
  { match: '서창', prefix: 'SC' },
]

function syllablePrefixLetter(ch: string): string | null {
  const code = ch.codePointAt(0)
  if (code === undefined || code < 0xac00 || code > 0xd7a3) return null
  const s = code - 0xac00
  const cho = Math.floor(s / 588)
  const jung = Math.floor((s % 588) / 28)
  const initial = CHO[cho] ?? ''
  const vowel = JUNG[jung] ?? ''
  const roman = initial || vowel
  if (!roman) return null
  return roman[0]!.toUpperCase()
}

function normalizeCustomerForPrefix(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[()[\]（）【】]/g, ' ')
    .replace(/[㈜]/g, ' ')
    .replace(/^주식회사\s*/u, '')
    .replace(/\s*주식회사$/u, '')
    .replace(/^주\s+/u, '')
    .replace(/\s+주$/u, '')
    .replace(/\s+/g, '')
}

/** 접두사 정규화 — 영문·숫자만, 대문자, 최대 6자 */
export function normalizeCustomerCodePrefix(value: string | null | undefined) {
  const cleaned = String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
  if (!cleaned) return ''
  return cleaned.slice(0, 6)
}

/** 고객사명 → 접두사 (한글 음절 로마자 첫글자, 5글자 이상이면 앞 3자) */
export function orderCodePrefixFromCustomer(customer: string): string {
  const letters: string[] = []
  for (const ch of customer.replace(/\s+/g, '')) {
    if (/[A-Za-z]/.test(ch)) {
      letters.push(ch.toUpperCase())
      continue
    }
    if (/[0-9]/.test(ch)) {
      letters.push(ch)
      continue
    }
    const letter = syllablePrefixLetter(ch)
    if (letter) letters.push(letter)
  }

  let prefix = letters.join('')
  if (prefix.length > 4) prefix = prefix.slice(0, 3)
  if (!prefix) return FALLBACK_ORDER_PREFIX
  return prefix
}

function overridePrefixFromCustomer(customer: string): string | null {
  const normalized = normalizeCustomerForPrefix(customer)
  if (!normalized) return null
  for (const row of CUSTOMER_CODE_PREFIX_OVERRIDES) {
    const key = normalizeCustomerForPrefix(row.match)
    if (!key) continue
    if (normalized === key || normalized.includes(key)) return row.prefix
  }
  return null
}

/**
 * 작업번호용 고객사 접두사.
 * 1) 거래처에 등록된 code_prefix
 * 2) 관용 매핑 (리텍→LEE, 파스텍→FAS …)
 * 3) 고객사명 자동 로마자
 */
export function resolveCustomerCodePrefix(
  customer: string,
  partnerCodePrefix?: string | null,
): string {
  const fromPartner = normalizeCustomerCodePrefix(partnerCodePrefix)
  if (fromPartner) return fromPartner

  const override = overridePrefixFromCustomer(customer)
  if (override) return override

  return orderCodePrefixFromCustomer(customer)
}

export function yymmddFromYmd(ymd: string): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return '000000'
  return `${match[1].slice(2)}${match[2]}${match[3]}`
}

/** 작업번호 접두 구간 — {고객접두}-{YYMMDD} (예: LEE-260904) */
export function formatOrderWorkNumberBase(
  customer: string,
  orderDate?: string | null,
  partnerCodePrefix?: string | null,
) {
  const prefix = resolveCustomerCodePrefix(customer, partnerCodePrefix)
  const ymd = String(orderDate || '').trim() || todayYmdSeoul()
  return `${prefix}-${yymmddFromYmd(ymd)}`
}

/** 자동 발급 예시: MRO-YYMMDD-01 (발주일 기준) */
export function formatAutoOrderCodeExample(orderDate?: string): string {
  const ymd = String(orderDate || '').trim() || todayYmdSeoul()
  return `MRO-${yymmddFromYmd(ymd)}-01`
}
