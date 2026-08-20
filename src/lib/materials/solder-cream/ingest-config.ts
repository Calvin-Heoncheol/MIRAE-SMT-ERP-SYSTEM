/** 설비 PC 에이전트 → ERP 로그 수신 API 키 (서버 전용) */
export function getSolderPasteIngestKey() {
  return process.env.SOLDER_PASTE_INGEST_KEY?.trim() || ''
}

export function isValidSolderPasteIngestKey(provided: string | null | undefined) {
  const expected = getSolderPasteIngestKey()
  if (!expected || !provided?.trim()) return false
  return provided.trim() === expected
}

/** D:\Log\2026\8\19.txt → 2026/8/19.txt */
export function normalizeSolderPasteSourceName(input: {
  sourceName?: string
  sourcePath?: string
}) {
  const raw = (input.sourceName || input.sourcePath || '').trim().replace(/\\/g, '/')
  if (!raw) return ''

  const logMatch = raw.match(/(?:^|\/)Log\/(\d{4})\/(\d{1,2})\/(\d{1,2})\.txt$/i)
  if (logMatch) {
    const [, year, month, day] = logMatch
    return `${year}/${Number(month)}/${Number(day)}.txt`
  }

  const fileMatch = raw.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\.txt$/)
  if (fileMatch) {
    const [, year, month, day] = fileMatch
    return `${year}/${Number(month)}/${Number(day)}.txt`
  }

  return raw.split('/').pop() || raw
}

/** 오늘·어제 등 설비 PC에서 읽을 상대 경로 */
export function buildSolderPasteLogRelativePath(date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  return `${year}/${month}/${day}.txt`
}

export function resolveSolderPasteLogFilePath(logRoot: string, date: Date) {
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const normalizedRoot = logRoot.replace(/[\\/]+$/, '')
  return `${normalizedRoot}\\${year}\\${month}\\${day}.txt`
}
