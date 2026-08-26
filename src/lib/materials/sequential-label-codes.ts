/**
 * 시작 코드의 끝 숫자만 증가시켜 연속 바코드 목록을 만든다.
 * 예: WAA26881000 × 3 → WAA26881000, WAA26881001, WAA26881002
 */
export function expandSequentialLabelCodes(startCode: string, count: number): string[] {
  const trimmed = String(startCode || '').trim()
  const total = Math.max(0, Math.floor(Number(count) || 0))
  if (!trimmed || total < 1) return []

  const match = trimmed.match(/^(.*?)(\d+)$/)
  if (!match) {
    // 끝자리가 숫자가 아니면 1장만 허용
    return total === 1 ? [trimmed] : []
  }

  const prefix = match[1] ?? ''
  const digits = match[2] ?? ''
  const width = digits.length
  const start = BigInt(digits)

  const codes: string[] = []
  for (let index = 0; index < total; index += 1) {
    const value = start + BigInt(index)
    const raw = value.toString()
    const padded = raw.length >= width ? raw : raw.padStart(width, '0')
    codes.push(`${prefix}${padded}`)
  }
  return codes
}

export function describeSequentialLabelRange(startCode: string, count: number) {
  const codes = expandSequentialLabelCodes(startCode, count)
  if (!codes.length) return ''
  if (codes.length === 1) return codes[0]!
  return `${codes[0]} ~ ${codes[codes.length - 1]}`
}
