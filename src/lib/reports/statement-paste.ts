/**
 * 거래명세서 붙여넣기 파서
 * 형식:
 * - 엑셀 한 줄: 품목코드 · 품목명 · 수량 · 단가 · 금액 (탭 / 공백)
 * - 또는 블록당 5줄(코드/품명/수량/단가/금액)
 */

export const STATEMENT_PASTE_COLUMNS = [
  { key: 'productCode', label: '품목코드', required: true },
  { key: 'productName', label: '품목명', required: true },
  { key: 'quantity', label: '수량', required: true },
  { key: 'unitPrice', label: '단가', required: true },
  { key: 'amount', label: '금액' },
] as const

export function statementPasteSampleValues() {
  return ['M0105030002', 'R4-28', '3000', '920', '2760000']
}

export function statementPastePlaceholder() {
  const header = STATEMENT_PASTE_COLUMNS.map((column) => column.label).join('\t')
  const sample = statementPasteSampleValues().join('\t')
  return `${header}\n${sample}`
}

export type ParsedStatementPasteLine = {
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  amount: number
}

function parseNumberToken(raw: string) {
  const cleaned = String(raw || '')
    .trim()
    .replace(/,/g, '')
    .replace(/원/g, '')
    .replace(/\s+/g, '')
  if (!cleaned) return null
  const n = Number(cleaned)
  if (!Number.isFinite(n)) return null
  return n
}

function parseFieldBlock(parts: string[]): ParsedStatementPasteLine | null {
  if (parts.length < 4) return null
  const productCode = parts[0]!.trim()
  const productName = parts[1]!.trim()
  const quantity = parseNumberToken(parts[2]!)
  const unitPrice = parseNumberToken(parts[3]!)
  const amountRaw = parts.length >= 5 ? parseNumberToken(parts[4]!) : null
  if (!productCode) return null
  if (quantity == null || quantity <= 0) return null
  if (unitPrice == null || unitPrice < 0) return null

  const qty = Math.max(1, Math.floor(quantity))
  const price = Math.max(0, Math.round(unitPrice))
  const expected = qty * price
  const amount =
    amountRaw != null && Math.abs(Math.round(amountRaw) - expected) <= 1
      ? Math.round(amountRaw)
      : expected

  return {
    productCode,
    productName: productName || productCode,
    quantity: qty,
    unitPrice: price,
    amount,
  }
}

function isHeaderLine(line: string) {
  const compact = line.replace(/\s+/g, '')
  if (compact.includes('품목코드') && compact.includes('품목명')) return true
  const first = line.trim().split(/[\t\s]+/)[0] || ''
  return STATEMENT_PASTE_COLUMNS.some((column) => column.label === first)
}

/** 엑셀 탭이 브라우저에서 공백으로 바뀐 한 줄도 인식 (품목명 공백 허용) */
function parseSpaceSeparatedRow(line: string): ParsedStatementPasteLine | null {
  const tokens = line.split(/\s+/).filter(Boolean)
  if (tokens.length < 4) return null

  const numericFromEnd: string[] = []
  while (tokens.length >= 2 && numericFromEnd.length < 3) {
    const last = tokens[tokens.length - 1]!
    if (parseNumberToken(last) == null) break
    numericFromEnd.unshift(last)
    tokens.pop()
  }
  if (numericFromEnd.length < 2 || tokens.length < 1) return null

  const productCode = tokens[0]!.trim()
  const productName = tokens.slice(1).join(' ').trim()
  if (!productCode) return null

  return parseFieldBlock([
    productCode,
    productName || productCode,
    numericFromEnd[0]!,
    numericFromEnd[1]!,
    numericFromEnd[2] || '',
  ])
}

function parseHorizontalRow(line: string): ParsedStatementPasteLine | null {
  const normalized = line.replace(/\u00a0/g, ' ').replace(/\u3000/g, ' ').trim()
  if (!normalized) return null

  if (normalized.includes('\t')) {
    const cells = normalized.split('\t').map((cell) => cell.trim()).filter(Boolean)
    const parsed = parseFieldBlock(cells)
    if (parsed) return parsed
  }

  const wide = normalized.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean)
  if (wide.length >= 4) {
    const parsed = parseFieldBlock(wide)
    if (parsed) return parsed
  }

  return parseSpaceSeparatedRow(normalized)
}

/**
 * 엑셀/문서에서 복사한 5줄 블록 또는 한 줄(코드 품명 수량 단가 금액)을 품목 목록으로 변환합니다.
 */
export function parseStatementPasteText(
  raw: string,
): { ok: true; lines: ParsedStatementPasteLine[] } | { ok: false; detail: string } {
  const text = String(raw || '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\u00a0/g, ' ')
    .replace(/\u3000/g, ' ')
    .trim()
  if (!text) {
    return { ok: false, detail: '붙여넣을 내용이 없습니다.' }
  }

  let rawLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  if (rawLines[0] && isHeaderLine(rawLines[0])) {
    rawLines = rawLines.slice(1)
  }
  if (!rawLines.length) {
    return { ok: false, detail: '붙여넣을 내용이 없습니다.' }
  }

  const horizontal = rawLines.map((line) => parseHorizontalRow(line))
  if (horizontal.every((line) => line)) {
    return { ok: true, lines: horizontal as ParsedStatementPasteLine[] }
  }

  if (rawLines.length % 5 !== 0) {
    const failed = rawLines.find((line, index) => !horizontal[index]) || rawLines[0]!
    return {
      ok: false,
      detail: `형식이 올바르지 않습니다. 한 줄에 품목코드 품목명 수량 단가 금액, 또는 5줄 단위로 붙여넣어 주세요. (예: ${failed.slice(0, 40)})`,
    }
  }

  const lines: ParsedStatementPasteLine[] = []
  for (let i = 0; i < rawLines.length; i += 5) {
    const parsed = parseFieldBlock(rawLines.slice(i, i + 5))
    if (!parsed) {
      return {
        ok: false,
        detail: `${i / 5 + 1}번째 품목 형식이 올바르지 않습니다. (코드·수량·단가 확인)`,
      }
    }
    lines.push(parsed)
  }

  if (!lines.length) {
    return { ok: false, detail: '인식된 품목이 없습니다.' }
  }

  return { ok: true, lines }
}
