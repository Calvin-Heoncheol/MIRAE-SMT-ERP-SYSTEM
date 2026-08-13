import { todayYmdSeoul } from '@/lib/orders/utils'

/** @deprecated 고객사 접두사 방식은 MRO-YYMMDD-NN 으로 대체됨. 과거 데이터/표시용만 유지 */

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

/** 고객사명 → 주문코드 접두사 (레거시 SC-0001 등 표시용) */
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

function yymmddFromYmd(ymd: string): string {
  const match = ymd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return '000000'
  return `${match[1].slice(2)}${match[2]}${match[3]}`
}

/** 자동 발급 예시: MRO-YYMMDD-01 (발주일 기준) */
export function formatAutoOrderCodeExample(orderDate?: string): string {
  const ymd = String(orderDate || '').trim() || todayYmdSeoul()
  return `MRO-${yymmddFromYmd(ymd)}-01`
}
