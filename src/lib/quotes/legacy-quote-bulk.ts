import { todayYmdSeoul } from '@/lib/orders/utils'
import type { LegacyQuoteFormState } from '@/lib/quotes/legacy-quote'
import { defaultLegacyQuoteForm } from '@/lib/quotes/legacy-quote'

export const LEGACY_QUOTE_BULK_COLUMNS = [
  { key: 'quoteDate', label: '견적일' },
  { key: 'productionKind', label: '구분' },
  { key: 'customer', label: '고객사', required: true },
  { key: 'productName', label: '제품명', required: true },
  { key: 'smd', label: 'SMD' },
  { key: 'post', label: '후공정' },
  { key: 'material', label: '자재' },
] as const

export type LegacyQuoteBulkColumnKey = (typeof LEGACY_QUOTE_BULK_COLUMNS)[number]['key']

export type LegacyQuoteBulkParseResult =
  | { ok: true; rows: LegacyQuoteFormState[] }
  | { ok: false; detail: string }

function normalizePasteRawText(text: string) {
  return text
    .replace(/\uFEFF/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u3000/g, ' ')
}

function normalizeCell(value: string) {
  return normalizePasteRawText(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

function splitTsvRows(text: string): string[][] {
  const input = normalizePasteRawText(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  return input
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0)
    .map((line) => line.split('\t').map(normalizeCell))
}

function looksLikeHeader(cells: string[]) {
  const joined = cells.join(' ').toLowerCase()
  return (
    joined.includes('고객') ||
    joined.includes('제품') ||
    joined.includes('견적') ||
    joined.includes('smd') ||
    joined.includes('후공정')
  )
}

function parseMoneyCell(raw: string) {
  const cleaned = raw.replace(/[,₩원\s]/g, '')
  if (!cleaned) return 0
  const value = Number(cleaned)
  if (!Number.isFinite(value) || value < 0) return null
  return Math.round(value)
}

function parseProductionKind(raw: string): '샘플' | '양산' {
  const value = raw.trim()
  if (value === '샘플' || value.toLowerCase() === 'sample') return '샘플'
  return '양산'
}

function parseQuoteDate(raw: string, fallback: string) {
  const value = raw.trim()
  if (!value) return fallback
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const match = value.match(/^(\d{4})[./](\d{1,2})[./](\d{1,2})$/)
  if (match) {
    const y = match[1]
    const m = match[2].padStart(2, '0')
    const d = match[3].padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  return null
}

export function legacyQuoteBulkPasteSampleValues() {
  return [todayYmdSeoul(), '양산', '미래전자', '메인보드 (V1)', '1200', '800', '500']
}

export function legacyQuoteBulkPastePlaceholder() {
  const header = LEGACY_QUOTE_BULK_COLUMNS.map((column) => column.label).join('\t')
  const sample = legacyQuoteBulkPasteSampleValues().join('\t')
  return `${header}\n${sample}`
}

export function parseLegacyQuoteBulkPaste(text: string): LegacyQuoteBulkParseResult {
  const rows = splitTsvRows(text)
  if (!rows.length) {
    return { ok: false, detail: '붙여넣을 내용이 없습니다.' }
  }

  const expected = LEGACY_QUOTE_BULK_COLUMNS.length
  let dataRows = rows
  if (looksLikeHeader(rows[0] || [])) {
    dataRows = rows.slice(1)
  }
  if (!dataRows.length) {
    return { ok: false, detail: '헤더만 있고 데이터 행이 없습니다.' }
  }

  const today = todayYmdSeoul()
  const parsed: LegacyQuoteFormState[] = []
  const errors: string[] = []

  dataRows.forEach((cells, index) => {
    const lineNo = index + 1
    if (cells.every((cell) => !cell)) return

    if (cells.length < 4) {
      errors.push(`${lineNo}행: 고객사·제품명 열이 부족합니다.`)
      return
    }

    // 열 수가 모자라면 뒤를 빈 칸으로 채움 (자재 비용 생략 허용)
    const padded = [...cells]
    while (padded.length < expected) padded.push('')

    const quoteDate = parseQuoteDate(padded[0] || '', today)
    if (!quoteDate) {
      errors.push(`${lineNo}행: 견적일 형식이 올바르지 않습니다. (YYYY-MM-DD)`)
      return
    }

    const customer = padded[2] || ''
    const productName = padded[3] || ''
    if (!customer.trim()) {
      errors.push(`${lineNo}행: 고객사가 비어 있습니다.`)
      return
    }
    if (!productName.trim()) {
      errors.push(`${lineNo}행: 제품명이 비어 있습니다.`)
      return
    }

    const smd = parseMoneyCell(padded[4] || '')
    const post = parseMoneyCell(padded[5] || '')
    const material = parseMoneyCell(padded[6] || '')
    if (smd == null || post == null || material == null) {
      errors.push(`${lineNo}행: 비용(SMD/후공정/자재)은 숫자여야 합니다.`)
      return
    }

    const row = defaultLegacyQuoteForm()
    row.quoteDate = quoteDate
    row.productionKind = parseProductionKind(padded[1] || '')
    row.customer = customer.trim()
    row.productName = productName.trim()
    row.smd = String(smd)
    row.post = String(post)
    row.material = String(material)
    parsed.push(row)
  })

  if (errors.length) {
    return { ok: false, detail: errors.slice(0, 8).join('\n') }
  }
  if (!parsed.length) {
    return { ok: false, detail: '등록할 행이 없습니다.' }
  }

  return { ok: true, rows: parsed }
}
