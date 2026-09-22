export function normalizeDesignatorKey(value: string) {
  return value.trim().replace(/^[@#]+/, '').toUpperCase()
}

/** Allegro 멀티보드 접두 제거 (1C29 → C29). BOM 매칭용 */
export function stripBoardPrefixDesignatorKey(value: string) {
  return normalizeDesignatorKey(value).replace(/^\d{1,3}(?=[A-Z])/, '')
}

/** BOM·좌표 조회 시 시도할 키 (원문 + 접두 제거) */
export function designatorLookupKeys(value: string): string[] {
  const full = normalizeDesignatorKey(value)
  if (!full) return []
  const stripped = stripBoardPrefixDesignatorKey(full)
  return stripped && stripped !== full ? [full, stripped] : [full]
}

export function looksLikeDesignatorToken(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  const upper = trimmed.toUpperCase()
  if (/^(REFDES|DESIGNATOR|REFERENCE|COMP|SYM|TOP|BOT|LAYER|X|Y)$/i.test(upper)) return false
  // R1 / C10 / U3A — 또는 멀티보드 1C1 / 2R10
  return /^[@#]?(\d{1,3})?[A-Z]{1,6}\d+[A-Z0-9-]*$/i.test(trimmed)
}

function splitDesignatorParts(raw: string) {
  const text = raw.trim()
  if (!text) return []
  // 일반/전각 쉼표·세미콜론·공백
  if (/[,，、;；]/.test(text)) {
    return text
      .split(/[,，、;；]+/)
      .map((part) => part.trim())
      .filter(Boolean)
  }
  return text
    .split(/[;\s]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function looksLikeDesignatorField(raw: string) {
  const text = raw.trim()
  if (!text) return false
  if (/^[A-Z]{1,6}\d+\s*[-~]\s*([A-Z]{0,6})?\d+$/i.test(text)) return true

  const parts = splitDesignatorParts(text)
  if (!parts.length) return false

  let hits = 0
  for (const part of parts) {
    if (looksLikeDesignatorToken(part)) hits += 1
    else if (/^[A-Z]{1,6}\d+\s*[-~]\s*([A-Z]{0,6})?\d+$/i.test(part)) hits += 1
  }
  return hits / parts.length >= 0.5
}

/** "R1,R2,R3" / "R1 R2" / "R1;R2" / "R1-R10" 등을 개별 designator로 분리 */
export function explodeDesignators(raw: string): string[] {
  const text = raw.trim()
  if (!text) return []

  const parts = splitDesignatorParts(text)

  const result: string[] = []
  for (const part of parts) {
    const range = part.match(/^([A-Za-z]+)(\d+)\s*[-~]\s*([A-Za-z]*)(\d+)$/)
    if (range) {
      const prefix = range[1]!
      const endPrefix = range[3] || prefix
      if (prefix.toUpperCase() !== endPrefix.toUpperCase()) {
        result.push(normalizeDesignatorKey(part))
        continue
      }
      const start = Number(range[2])
      const end = Number(range[4])
      if (Number.isFinite(start) && Number.isFinite(end) && end >= start && end - start <= 200) {
        for (let i = start; i <= end; i += 1) {
          result.push(normalizeDesignatorKey(`${prefix}${i}`))
        }
        continue
      }
    }
    result.push(normalizeDesignatorKey(part))
  }

  return [...new Set(result.filter(Boolean))]
}

export function scoreDesignatorColumn(rows: string[][], headerIndex: number, colIndex: number) {
  let hits = 0
  let total = 0
  const end = Math.min(rows.length, headerIndex + 31)
  for (let rowIndex = headerIndex + 1; rowIndex < end; rowIndex += 1) {
    const value = String(rows[rowIndex]?.[colIndex] ?? '').trim()
    if (!value) continue
    total += 1
    if (looksLikeDesignatorField(value)) hits += 1
    else if (/^\d+$/.test(value)) hits -= 0.25
  }
  if (!total) return 0
  return Math.max(0, hits / total)
}
