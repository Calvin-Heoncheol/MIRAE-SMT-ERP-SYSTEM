/**
 * 거래명세서 붙여넣기 파서
 * 형식:
 * - 엑셀 TSV 한 줄: 품목코드 · 품목명 · 수량 · 단가 · 금액
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

function parseFiveLineBlock(parts: string[]): ParsedStatementPasteLine | null {
  if (parts.length < 5) return null
  const productCode = parts[0]!.trim()
  const productName = parts[1]!.trim()
  const quantity = parseNumberToken(parts[2]!)
  const unitPrice = parseNumberToken(parts[3]!)
  const amountRaw = parseNumberToken(parts[4]!)
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

/**
 * 엑셀/문서에서 복사한 5줄 블록 또는 탭 구분 한 줄(코드명수량단가금액)을 품목 목록으로 변환합니다.
 */
export function parseStatementPasteText(
  raw: string,
): { ok: true; lines: ParsedStatementPasteLine[] } | { ok: false; detail: string } {
  const text = String(raw || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim()
  if (!text) {
    return { ok: false, detail: '붙여넣을 내용이 없습니다.' }
  }

  const lines: ParsedStatementPasteLine[] = []

  // 1) 탭/콤마로 한 줄에 5칸인 경우
  const rawLines = text
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)

  const rowish = rawLines.every((line) => {
    const cells = line.split(/\t+|\s{2,}/).filter(Boolean)
    return cells.length >= 5 || line.includes('\t')
  })

  if (rowish && rawLines.some((line) => line.includes('\t') || /\s{2,}/.test(line))) {
    for (const line of rawLines) {
      const cells = line.split(/\t+/).map((cell) => cell.trim()).filter(Boolean)
      if (cells.length < 5) {
        const spaced = line.split(/\s{2,}/).map((cell) => cell.trim()).filter(Boolean)
        if (spaced.length >= 5) {
          const parsed = parseFiveLineBlock(spaced)
          if (parsed) lines.push(parsed)
          continue
        }
        return {
          ok: false,
          detail: `형식이 올바르지 않습니다: ${line.slice(0, 40)}`,
        }
      }
      const parsed = parseFiveLineBlock(cells)
      if (!parsed) {
        return { ok: false, detail: `숫자를 확인하세요: ${line.slice(0, 40)}` }
      }
      lines.push(parsed)
    }
  } else {
    // 2) 5줄 반복 블록
    if (rawLines.length % 5 !== 0) {
      return {
        ok: false,
        detail: `5줄(코드·품명·수량·단가·금액) 단위로 붙여넣어 주세요. (현재 ${rawLines.length}줄)`,
      }
    }
    for (let i = 0; i < rawLines.length; i += 5) {
      const parsed = parseFiveLineBlock(rawLines.slice(i, i + 5))
      if (!parsed) {
        return {
          ok: false,
          detail: `${i / 5 + 1}번째 품목 형식이 올바르지 않습니다. (코드·수량·단가 확인)`,
        }
      }
      lines.push(parsed)
    }
  }

  if (!lines.length) {
    return { ok: false, detail: '인식된 품목이 없습니다.' }
  }

  return { ok: true, lines }
}
