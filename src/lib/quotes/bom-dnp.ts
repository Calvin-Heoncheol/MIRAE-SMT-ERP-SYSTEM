import type { BomLine } from '@/lib/quotes/parse-altium-bom'

export type BomExcludeReason = 'strikethrough' | 'dnp_text' | 'qty_zero'

export const BOM_DNP_TEXT_HINT =
  /\b(DNP|DNI|DNF|NOT\s*POPULATED|NOT\s*FITTED|DO\s*NOT\s*(POPULATE|INSTALL|PLACE|FIT)|NO\s*FIT|미실장|미장착|미부착)\b/i

const BOM_FITTED_COLUMN_HINT =
  /^(fitted|populate|populated|population|mount|mounted|installation|install|dnp|장착|실장|populatestatus)$/i

function headerLooksLikeFittedColumn(label: string) {
  const key = label.replace(/[^\w가-힣]+/g, '').toLowerCase()
  const trimmed = label.trim().toLowerCase()
  if (BOM_FITTED_COLUMN_HINT.test(key) || BOM_FITTED_COLUMN_HINT.test(trimmed)) return true
  return /fitted|populate|population|populated|mount|install|dnp|장착|실장/.test(key)
}

export function isBomUnfittedCellValue(value: string) {
  const normalized = value.trim().toLowerCase()
  if (!normalized) return false
  return (
    /^(no|false|0|dnp|dnf|nm|na|x|미실장|미장착|미부착)$/.test(normalized) ||
    /not\s*(fitted|populated|installed|placed|mounted)/.test(normalized)
  )
}

/** Altium CSV 등: "NM, NA, 1608" — Not Mounted (CSV는 취소선 없음) */
export function cellMatchesBomUnmountedMarker(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (BOM_DNP_TEXT_HINT.test(trimmed)) return true
  if (/^NM\s*[,;]/i.test(trimmed)) return true
  if (/\bNM\s*,\s*NA\b/i.test(trimmed)) return true
  return false
}

export function textContainsBomUnmountedMarker(text: string) {
  if (!text.trim()) return false
  if (BOM_DNP_TEXT_HINT.test(text)) return true
  return text.split(/[,;]/).some((part) => cellMatchesBomUnmountedMarker(part) || /^\s*NM\s*$/i.test(part))
}

export function detectBomExcludeReasonFromRow(
  cells: string[],
  header: string[],
): BomExcludeReason | null {
  for (let index = 0; index < header.length; index += 1) {
    const label = header[index] ?? ''
    if (!headerLooksLikeFittedColumn(label)) continue
    if (isBomUnfittedCellValue(cells[index] ?? '')) return 'dnp_text'
  }

  for (const cell of cells) {
    if (cellMatchesBomUnmountedMarker(cell)) return 'dnp_text'
  }

  return null
}

export function detectBomExcludeReason(
  line: Pick<BomLine, 'designatorsRaw' | 'comment' | 'footprint' | 'description' | 'quantity' | 'mpn'>,
  options?: { strikethrough?: boolean; rowCells?: string[]; rowHeader?: string[] },
): BomExcludeReason | null {
  if (options?.strikethrough) return 'strikethrough'
  if (line.quantity === 0) return 'qty_zero'

  if (options?.rowCells && options?.rowHeader) {
    const fittedReason = detectBomExcludeReasonFromRow(options.rowCells, options.rowHeader)
    if (fittedReason) return fittedReason
  } else if (options?.rowCells) {
    for (const cell of options.rowCells) {
      if (cellMatchesBomUnmountedMarker(cell)) return 'dnp_text'
    }
  }

  const text = [line.designatorsRaw, line.comment, line.footprint, line.description, line.mpn]
    .filter(Boolean)
    .join(' ')
  if (textContainsBomUnmountedMarker(text)) return 'dnp_text'

  return null
}

export function bomExcludeUsesNmMarker(line: Pick<BomLine, 'comment' | 'description'>) {
  return [line.comment, line.description].some((value) => cellMatchesBomUnmountedMarker(value))
}

export function bomExcludeReasonLabel(
  reason: BomExcludeReason,
  line?: Pick<BomLine, 'comment' | 'description'>,
) {
  if (reason === 'strikethrough') return 'BOM 미실장 (취소선)'
  if (reason === 'qty_zero') return 'BOM 미실장 (수량 0)'
  if (line && bomExcludeUsesNmMarker(line)) return 'BOM 미실장 (NM)'
  return 'BOM 미실장 (DNP)'
}

export function bomUnpopulatedBadgeHint(
  reason?: BomExcludeReason,
  line?: Pick<BomLine, 'comment' | 'description'>,
) {
  if (reason === 'strikethrough') return '취소선'
  if (reason === 'qty_zero') return '수량 0'
  if (line && bomExcludeUsesNmMarker(line)) return 'NM'
  if (reason === 'dnp_text') return 'DNP'
  return undefined
}

export function isPickPlaceBomUnpopulatedRow(row: {
  category: string
  bomExcluded?: boolean
  detail?: string
}) {
  return row.category === 'skip' && (Boolean(row.bomExcluded) || Boolean(row.detail?.startsWith('BOM 미실장')))
}
