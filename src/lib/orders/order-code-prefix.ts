/** 한글 음절 → 개정 로마자 기반 접두사 (DB generate_order_code 와 동일 규칙) */

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

/** 고객사명 → 주문코드 접두사 (예: 서창→SC, 파스텍→PST). 불가 시 MRO */
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

export function formatAutoOrderCodeExample(customer: string): string {
  return `${orderCodePrefixFromCustomer(customer)}-0001`
}
