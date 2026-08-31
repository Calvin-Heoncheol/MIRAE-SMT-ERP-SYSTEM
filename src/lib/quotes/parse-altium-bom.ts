import { detectBomHeader, fillMissingBomColumns, formatBomColumnMappingNote, type BomColumnMap } from '@/lib/quotes/bom-columns'
import { detectBomExcludeReason, type BomExcludeReason } from '@/lib/quotes/bom-dnp'
import {
  explodeDesignators,
  looksLikeDesignatorField,
  looksLikeDesignatorToken,
  normalizeDesignatorKey,
} from '@/lib/quotes/designator-utils'

export type { BomExcludeReason } from '@/lib/quotes/bom-dnp'

export type BomLine = {
  lineIndex: number
  designatorsRaw: string
  designators: string[]
  comment: string
  footprint: string
  description: string
  quantity: number
  mpn: string
  manufacturer: string
  supplier: string
  supplierPart: string
  excluded?: boolean
  excludeReason?: BomExcludeReason
}

export type AltiumBomSummary = {
  lineCount: number
  designatorCount: number
  uniquePartLines: number
  excludedLineCount: number
  excludedDesignatorCount: number
  warnings: string[]
}

export type AltiumBomAnalysis = {
  fileName: string
  lines: BomLine[]
  designatorIndex: Record<string, BomLine>
  summary: AltiumBomSummary
}

export type AltiumBomParseResult =
  | { ok: true; analysis: AltiumBomAnalysis }
  | { ok: false; detail: string }

function cellAt(cells: string[], index: number) {
  return index >= 0 ? cells[index] || '' : ''
}

/** @deprecated import from designator-utils */
export { explodeDesignators } from '@/lib/quotes/designator-utils'

function parseQuantity(value: string, designatorCount: number) {
  const trimmed = value.replace(/,/g, '').trim()
  if (trimmed === '0') return 0
  const parsed = Number(trimmed)
  if (Number.isFinite(parsed) && parsed > 0) return Math.floor(parsed)
  return designatorCount > 0 ? designatorCount : 1
}

function isLikelyDataRow(cells: string[], columns: BomColumnMap) {
  const designator = cellAt(cells, columns.designator)
  if (!designator) return false
  const lower = designator.toLowerCase()
  if (lower === 'designator' || lower === 'refdes' || lower === 'reference') return false
  return true
}

function looksLikeBomMpn(value: string) {
  const trimmed = value.trim()
  return trimmed.length >= 8 && /^[A-Z0-9][A-Z0-9._/-]+$/i.test(trimmed) && /\d/.test(trimmed)
}

function looksLikeBomFootprint(value: string) {
  const trimmed = value.trim()
  return /^[A-Z]_\d{3,4}$/i.test(trimmed) || /^\d{4}$/.test(trimmed)
}

function looksLikeBomSpecValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^NM\s*[,;]/i.test(trimmed)) return true
  return /[\d.]+\s*(p|n|u|m|k|G|M|Ω|%)|[\d,]+\s*(p|n|u|m|k|M|%)/i.test(trimmed) || /\b\d{4}\b/.test(trimmed)
}

function inferBomFieldsFromRow(cells: string[], columns: BomColumnMap) {
  let comment = cellAt(cells, columns.comment)
  let description = cellAt(cells, columns.description)
  let footprint = cellAt(cells, columns.footprint)
  let mpn = cellAt(cells, columns.mpn)

  const reserved = new Set(
    Object.values(columns).filter((index) => index >= 0),
  )

  for (let index = 0; index < cells.length; index += 1) {
    if (reserved.has(index)) continue
    const cell = String(cells[index] ?? '').trim()
    if (!cell) continue
    if (looksLikeDesignatorField(cell)) continue
    if (/^\d+$/.test(cell)) continue

    if (/^capacitor|^resistor|^inductor|^connector|^diode|^transistor/i.test(cell)) {
      if (!description) description = cell
      continue
    }
    if (!mpn && looksLikeBomMpn(cell)) {
      mpn = cell
      continue
    }
    if (!footprint && looksLikeBomFootprint(cell)) {
      footprint = cell
      continue
    }
    if (!comment && looksLikeBomSpecValue(cell)) {
      comment = cell
      continue
    }
    if (!description && /without|polarity|chip|surface|mount/i.test(cell)) {
      description = cell
    }
  }

  return { comment, description, footprint, mpn }
}

export function parseBomRows(
  rows: string[][],
  fileName?: string,
  options?: {
    forcedDetection?: {
      headerIndex: number
      columns: import('@/lib/quotes/bom-columns').BomColumnMap
      note?: string
    }
    struckRows?: Set<number>
  },
): AltiumBomParseResult {
  const normalizedRows = rows
    .map((row) => row.map((cell) => String(cell ?? '').replace(/^"|"$/g, '').trim()))
    .filter((row) => row.some((cell) => cell.length > 0))

  if (!normalizedRows.length) {
    return { ok: false, detail: '파일이 비어 있습니다.' }
  }

  const detected = options?.forcedDetection
    ? {
        headerIndex: options.forcedDetection.headerIndex,
        columns: options.forcedDetection.columns,
      }
    : detectBomHeader(normalizedRows)
  if (!detected) {
    const preview = normalizedRows
      .slice(0, 5)
      .map((row) => row.filter(Boolean).join(' | '))
      .join('\n')
    return {
      ok: false,
      detail: `BOM 헤더를 찾을 수 없습니다. 부품 위치(Designator/Ref)와 Comment·Footprint·Description 중 하나 이상이 필요합니다.\n\n파일 앞부분:\n${preview}`,
    }
  }

  const { headerIndex, columns: detectedColumns } = detected
  const header = normalizedRows[headerIndex]!
  const columns = fillMissingBomColumns(header, normalizedRows, headerIndex, detectedColumns)
  const warnings: string[] = options?.forcedDetection?.note
    ? [options.forcedDetection.note]
    : []

  const struckRows = options?.struckRows ?? new Set<number>()
  const lines: BomLine[] = []
  const designatorIndex: Record<string, BomLine> = {}
  let excludedLineCount = 0
  let excludedDesignatorCount = 0

  for (let i = headerIndex + 1; i < normalizedRows.length; i += 1) {
    const cells = normalizedRows[i]!
    if (!isLikelyDataRow(cells, columns)) continue

    const designatorsRaw = cellAt(cells, columns.designator)
    const designators = explodeDesignators(designatorsRaw).filter(looksLikeDesignatorToken)
    if (!designators.length) continue

    const quantity = parseQuantity(cellAt(cells, columns.quantity), designators.length)
    const inferred = inferBomFieldsFromRow(cells, columns)
    const comment = inferred.comment
    const description = inferred.description
    const footprint = inferred.footprint
    const line: BomLine = {
      lineIndex: lines.length + 1,
      designatorsRaw,
      designators,
      comment: comment || description,
      footprint,
      description: description || comment,
      quantity,
      mpn: inferred.mpn || cellAt(cells, columns.mpn),
      manufacturer: cellAt(cells, columns.manufacturer),
      supplier: cellAt(cells, columns.supplier),
      supplierPart: cellAt(cells, columns.supplierPart),
    }

    const excludeReason = detectBomExcludeReason(line, {
      strikethrough: struckRows.has(i),
      rowCells: cells,
      rowHeader: header,
    })
    if (excludeReason) {
      line.excluded = true
      line.excludeReason = excludeReason
      excludedLineCount += 1
      excludedDesignatorCount += designators.length
    }

    lines.push(line)

    for (const designator of designators) {
      const key = normalizeDesignatorKey(designator)
      if (!key) continue
      if (!designatorIndex[key]) {
        designatorIndex[key] = line
      }
    }
  }

  if (!lines.length) {
    return { ok: false, detail: 'BOM 데이터 행을 찾을 수 없습니다.' }
  }

  const mappingNote = formatBomColumnMappingNote(header, columns)
  if (mappingNote && !warnings.some((warning) => warning.includes('인식된 컬럼'))) {
    warnings.push(mappingNote)
  }

  const linesWithoutMeta = lines.filter(
    (line) => !line.comment && !line.footprint && !line.description && !line.mpn,
  ).length
  if (lines.length > 0 && linesWithoutMeta / lines.length >= 0.5) {
    warnings.push(
      'Comment·Footprint·Description 컬럼을 제대로 읽지 못했습니다. Excel에서 헤더 행이 맞는지 확인하거나 CSV로 다시 저장해 주세요.',
    )
  }

  const designatorCount = lines.reduce((sum, line) => sum + line.designators.length, 0)
  const duplicateKeys = Object.entries(
    lines.flatMap((line) => line.designators).reduce<Record<string, number>>((acc, des) => {
      const key = normalizeDesignatorKey(des)
      acc[key] = (acc[key] || 0) + 1
      return acc
    }, {}),
  ).filter(([, count]) => count > 1)

  if (duplicateKeys.length) {
    warnings.push(`중복 Designator ${duplicateKeys.length}건 — 마지막 라인 기준으로 매칭합니다.`)
  }
  if (excludedDesignatorCount > 0) {
    warnings.push(
      `BOM 미실장 ${excludedDesignatorCount}건 — 취소선·NM/DNP·수량 0으로 자동 제외합니다.`,
    )
  }
  if (fileName && /\.csv$/i.test(fileName)) {
    warnings.push('CSV는 취소선·색상 서식을 읽을 수 없습니다. NM/DNP 텍스트로 미실장을 표시합니다.')
  }

  return {
    ok: true,
    analysis: {
      fileName: fileName || 'bom',
      lines,
      designatorIndex,
      summary: {
        lineCount: lines.length,
        designatorCount,
        uniquePartLines: lines.length,
        excludedLineCount,
        excludedDesignatorCount,
        warnings,
      },
    },
  }
}

export function formatAltiumBomSummary(analysis: AltiumBomAnalysis) {
  const { summary } = analysis
  return `BOM ${summary.lineCount}라인 · ${summary.designatorCount}개 부품위치`
}
