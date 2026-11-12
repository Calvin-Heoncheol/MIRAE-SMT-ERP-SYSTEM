import {
  addPickPlaceDipClassification,
  emptyPickPlaceDipStats,
  isPickPlaceDipCategory,
  type AltiumPickPlaceDipStats,
  type PickPlaceComponentCategory,
} from '@/lib/quotes/pick-place-mount-categories'
import { parsePickPlaceSide, type CanonicalPickPlaceRow } from '@/lib/quotes/canonical-pick-place'
import { detectPickPlaceHeader } from '@/lib/quotes/pick-place-columns'
import { normalizeDesignatorKey } from '@/lib/quotes/designator-utils'
import type { SmtSide } from '@/lib/quotes/types'
import type {
  AltiumPickPlaceAnalysis,
  AltiumPickPlaceLayerStats,
  AltiumPickPlaceParseResult,
  AltiumPickPlaceSummary,
  PickPlaceClassifiedRow,
  PickPlaceConfidence,
  PickPlaceQuoteField,
} from './pick-place-types'
import {
  appendPickPlaceReviewDetail,
  applyAutoClassificationReviewGates,
  cellAt,
  classificationForStats,
  classifyComponent,
  extractPcbName,
  extractUnits,
  milToMm,
  pickPlacePartTypeIdentity,
  pinCountFromFootprint,
  type Classification,
} from './pick-place-classify'

export function rebuildPickPlaceAnalysis(
  analysis: AltiumPickPlaceAnalysis,
  classifiedRows: PickPlaceClassifiedRow[],
): AltiumPickPlaceAnalysis {
  const gatedRows = applyPickPlaceRowSetReviewGates(classifiedRows)
  const top = emptyLayerStats()
  const bottom = emptyLayerStats()
  const dipTotals = emptyPickPlaceDipStats()
  const partTypeSets = emptyLayerPartTypeSets()
  let skipped = 0
  const xs: number[] = []
  const ys: number[] = []

  for (const row of gatedRows) {
    if (Number.isFinite(row.x)) xs.push(row.x)
    if (Number.isFinite(row.y)) ys.push(row.y)
    if (row.confidence !== 'certain' || row.category === 'skip') continue

    const classified = classificationForStats(row)
    if (!accumulateClassifiedRow(row, classified, top, bottom, dipTotals, partTypeSets)) {
      skipped += 1
    }
  }

  finalizeLayerPartCounts(top, partTypeSets.top)
  finalizeLayerPartCounts(bottom, partTypeSets.bottom)

  let sideInfo = inferSmtSide(top, bottom)
  // Allegro 등 MPN/부품값 없는 좌표만 있는 파일: 종수 집계는 0이어도 면 분포로 단면/양면 판별
  if (top.partCount === 0 && bottom.partCount === 0) {
    const hasTopSide = gatedRows.some((row) => row.side === 'top' && row.category !== 'skip')
    const hasBottomSide = gatedRows.some((row) => row.side === 'bottom' && row.category !== 'skip')
    if (hasTopSide && hasBottomSide) {
      sideInfo = { side: 'double', confidence: 'certain' }
    } else if (hasTopSide || hasBottomSide) {
      sideInfo = { side: 'single', confidence: 'certain' }
    }
  }

  const totals = sumLayerStats(top, bottom)
  const pcbWidthMm = xs.length ? Math.max(...xs) - Math.min(...xs) : analysis.summary.pcbWidthMm
  const pcbHeightMm = ys.length ? Math.max(...ys) - Math.min(...ys) : analysis.summary.pcbHeightMm
  const ambiguousCount = gatedRows.filter(
    (row) => row.confidence === 'ambiguous' && row.category !== 'skip',
  ).length
  const certainCount = gatedRows.filter(
    (row) => row.confidence === 'certain' && row.category !== 'skip',
  ).length

  const summary: AltiumPickPlaceSummary = {
    ...analysis.summary,
    smtSide: sideInfo.side,
    top,
    bottom,
    totals,
    dipTotals,
    pcbWidthMm,
    pcbHeightMm,
    skipped,
  }

  return {
    ...analysis,
    summary,
    classifiedRows: gatedRows,
    quoteFields: buildQuoteFields(summary, gatedRows, sideInfo),
    certainCount,
    ambiguousCount,
    skippedCount: skipped,
  }
}

function emptyLayerStats(): AltiumPickPlaceLayerStats {
  return {
    partCount: 0,
    chip: 0,
    icPin: 0,
    bga: 0,
    smtOdd: 0,
    smtSpecial: 0,
  }
}

/** 동일 Designator가 여러 행에 있으면 모두 검토 필요 (데이터 무결성) */
function applyPickPlaceRowSetReviewGates(
  rows: PickPlaceClassifiedRow[],
): PickPlaceClassifiedRow[] {
  const keyToIndices = new Map<string, number[]>()

  for (const [index, row] of rows.entries()) {
    if (row.category === 'skip') continue
    const key = normalizeDesignatorKey(row.designator)
    if (!key) continue
    const indices = keyToIndices.get(key) ?? []
    indices.push(index)
    keyToIndices.set(key, indices)
  }

  const duplicateIndices = new Set<number>()
  for (const indices of keyToIndices.values()) {
    if (indices.length > 1) {
      for (const index of indices) duplicateIndices.add(index)
    }
  }

  if (!duplicateIndices.size) return rows

  return rows.map((row, index) => {
    if (!duplicateIndices.has(index)) return row
    return {
      ...row,
      confidence: 'ambiguous',
      detail: appendPickPlaceReviewDetail(row.detail, 'Designator 중복'),
    }
  })
}

type LayerPartTypeSets = {
  top: Set<string>
  bottom: Set<string>
}

function emptyLayerPartTypeSets(): LayerPartTypeSets {
  return { top: new Set(), bottom: new Set() }
}

function finalizeLayerPartCounts(stats: AltiumPickPlaceLayerStats, keys: Set<string>) {
  stats.partCount = keys.size
}

function addClassification(
  stats: AltiumPickPlaceLayerStats,
  classified: Classification,
  partTypeKeys: Set<string>,
  row: PickPlaceClassifiedRow,
) {
  if (!classified.countsTowardParts) return false
  if (isPickPlaceDipCategory(classified.category)) return false

  const identity = pickPlacePartTypeIdentity(row)
  // 자동 확정은 확실한 부품 식별만 종수에 반영. 사람 확정(reviewSource)은 허용.
  if (!identity.certain && !row.reviewSource) return false

  partTypeKeys.add(identity.key)
  if (classified.category === 'chip') stats.chip += 1
  else if (classified.category === 'odd') stats.smtOdd += 1
  else if (classified.category === 'special') stats.smtSpecial += 1
  else if (classified.category === 'ic') stats.icPin += classified.icPins
  else if (classified.category === 'bga') stats.bga += classified.bgaBalls
  return true
}

function accumulateClassifiedRow(
  row: PickPlaceClassifiedRow,
  classified: Classification,
  top: AltiumPickPlaceLayerStats,
  bottom: AltiumPickPlaceLayerStats,
  dipTotals: AltiumPickPlaceDipStats,
  partTypeSets: LayerPartTypeSets,
) {
  if (!rowCountsTowardQuoteTotals(row)) return false
  if (isPickPlaceDipCategory(classified.category)) {
    addPickPlaceDipClassification(dipTotals, classified.category)
    return true
  }
  const isBottom = row.side === 'bottom'
  const target = isBottom ? bottom : top
  const keys = isBottom ? partTypeSets.bottom : partTypeSets.top
  return addClassification(target, classified, keys, row)
}

function rowCountsTowardQuoteTotals(row: PickPlaceClassifiedRow) {
  return row.confidence === 'certain' && row.category !== 'skip'
}

function sumLayerStats(a: AltiumPickPlaceLayerStats, b: AltiumPickPlaceLayerStats): AltiumPickPlaceLayerStats {
  return {
    partCount: a.partCount + b.partCount,
    chip: a.chip + b.chip,
    icPin: a.icPin + b.icPin,
    bga: a.bga + b.bga,
    smtOdd: a.smtOdd + b.smtOdd,
    smtSpecial: a.smtSpecial + b.smtSpecial,
  }
}

function inferSmtSide(top: AltiumPickPlaceLayerStats, bottom: AltiumPickPlaceLayerStats): {
  side: SmtSide
  confidence: PickPlaceConfidence
  note?: string
} {
  const hasTop = top.partCount > 0
  const hasBottom = bottom.partCount > 0
  if (hasTop && hasBottom) return { side: 'double', confidence: 'certain' }
  if (hasTop || hasBottom) return { side: 'single', confidence: 'certain' }
  return { side: 'single', confidence: 'ambiguous', note: '실장 데이터 없음' }
}

function smtSideLabel(side: SmtSide) {
  if (side === 'double') return '양면'
  if (side === 'dual') return '듀얼'
  return '단면'
}

function fieldConfidence(
  rows: PickPlaceClassifiedRow[],
  categories: PickPlaceComponentCategory[],
  options?: { maxAmbiguousRatio?: number },
): PickPlaceConfidence {
  const matched = rows.filter((row) => categories.includes(row.category) && row.category !== 'skip')
  if (!matched.length) return 'certain'
  const ambiguous = matched.filter((row) => row.confidence === 'ambiguous')
  if (!ambiguous.length) return 'certain'
  const ratio = ambiguous.length / matched.length
  if (ratio <= (options?.maxAmbiguousRatio ?? 0.1)) return 'certain'
  return 'ambiguous'
}

function icPinFieldConfidence(rows: PickPlaceClassifiedRow[]): PickPlaceConfidence {
  const ics = rows.filter((row) => row.category === 'ic')
  if (!ics.length) return 'certain'
  let totalPins = 0
  let ambiguousPins = 0
  for (const row of ics) {
    const pin = pinCountFromFootprint(row.package)
    const pins = pin.pins
    totalPins += pins
    if (row.confidence === 'ambiguous') ambiguousPins += pins
  }
  if (!totalPins) return 'certain'
  return ambiguousPins / totalPins > 0.15 ? 'ambiguous' : 'certain'
}

function buildQuoteFields(
  summary: AltiumPickPlaceSummary,
  classifiedRows: PickPlaceClassifiedRow[],
  sideInfo: ReturnType<typeof inferSmtSide>,
): PickPlaceQuoteField[] {
  const { totals, top, bottom, smtSide } = summary

  return [
    {
      key: 'smtSide',
      label: '면',
      displayValue: smtSideLabel(smtSide),
      confidence: sideInfo.confidence,
      note: sideInfo.note,
    },
    {
      key: 'smtTopCount',
      label: 'TOP 종수',
      displayValue: String(top.partCount),
      confidence: fieldConfidence(
        classifiedRows.filter((row) => row.side === 'top'),
        ['chip', 'ic', 'bga', 'odd', 'special'],
      ),
      note: 'MPN 또는 부품값+패키지로 확정된 종만 집계 · 불확실은 검토',
    },
    {
      key: 'smtBotCount',
      label: 'BOT 종수',
      displayValue: smtSide === 'single' ? '0' : String(bottom.partCount),
      confidence:
        smtSide === 'single'
          ? 'certain'
          : fieldConfidence(
              classifiedRows.filter((row) => row.side === 'bottom'),
              ['chip', 'ic', 'bga', 'odd', 'special'],
            ),
      note: smtSide === 'single' ? undefined : 'MPN 또는 부품값+패키지로 확정된 종만 집계 · 불확실은 검토',
    },
    {
      key: 'chip',
      label: 'Chip',
      displayValue: String(totals.chip),
      confidence: fieldConfidence(classifiedRows, ['chip']),
    },
    {
      key: 'icPin',
      label: 'IC PIN',
      displayValue: String(totals.icPin),
      confidence: icPinFieldConfidence(classifiedRows),
    },
    {
      key: 'bga',
      label: 'BGA BALL',
      displayValue: String(totals.bga),
      confidence: fieldConfidence(classifiedRows, ['bga']),
    },
    {
      key: 'smtOdd',
      label: '이형',
      displayValue: String(totals.smtOdd),
      confidence: fieldConfidence(classifiedRows, ['odd']),
    },
    {
      key: 'smtSpecial',
      label: '특수/커넥터',
      displayValue: String(totals.smtSpecial),
      confidence: fieldConfidence(classifiedRows, ['special']),
    },
    {
      key: 'dipGeneral',
      label: '수납땜 소형',
      displayValue: String(summary.dipTotals.dipGeneral),
      confidence: fieldConfidence(classifiedRows, ['dip_general']),
    },
    {
      key: 'dipConnector',
      label: '수납땜 중형',
      displayValue: String(summary.dipTotals.dipConnector),
      confidence: fieldConfidence(classifiedRows, ['dip_connector']),
    },
    {
      key: 'dipWire',
      label: '수납땜 대형',
      displayValue: String(summary.dipTotals.dipWire),
      confidence: fieldConfidence(classifiedRows, ['dip_wire']),
    },
    {
      key: 'dipXLarge',
      label: '수납땜 초대형',
      displayValue: String(summary.dipTotals.dipXLarge),
      confidence: fieldConfidence(classifiedRows, ['dip_xlarge']),
    },
  ]
}

export function parsePickPlaceRows(
  rows: string[][],
  fileName?: string,
  options?: {
    forcedDetection?: {
      headerIndex: number
      columns: import('@/lib/quotes/pick-place-columns').PickPlaceColumnMap
      note?: string
    }
  },
): AltiumPickPlaceParseResult {
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
    : detectPickPlaceHeader(normalizedRows)
  if (!detected) {
    const preview = normalizedRows
      .slice(0, 5)
      .map((row) => row.filter(Boolean).join(' | '))
      .join('\n')
    return {
      ok: false,
      detail: `Pick&Place 헤더를 찾을 수 없습니다. 부품 위치(Designator/Ref)와 X·Y 좌표 컬럼이 필요합니다.\n\n파일 앞부분:\n${preview}`,
    }
  }

  const { headerIndex, columns } = detected
  const header = normalizedRows[headerIndex]!
  const hasLayerColumn = columns.layer >= 0

  const preamble = normalizedRows
    .slice(0, headerIndex)
    .map((row) => row.join('\t'))
    .join('\n')
  const pcbNameInfo = extractPcbName(preamble, fileName)
  const detectedUnits = extractUnits(preamble, header)
  const warnings: string[] = options?.forcedDetection?.note ? [options.forcedDetection.note] : []
  if (detectedUnits === 'mil') {
    warnings.push('좌표 단위 MILS → mm 변환 적용')
  }

  const classifiedRows: PickPlaceClassifiedRow[] = []
  const xs: number[] = []
  const ys: number[] = []

  for (let i = headerIndex + 1; i < normalizedRows.length; i += 1) {
    const cells = normalizedRows[i]!
    const designator = cellAt(cells, columns.designator)

    const rawLayer = hasLayerColumn ? cellAt(cells, columns.layer) : ''
    const side = parsePickPlaceSide(rawLayer, hasLayerColumn)
    let x = Number(cellAt(cells, columns.x))
    let y = Number(cellAt(cells, columns.y))
    if (detectedUnits === 'mil') {
      if (Number.isFinite(x)) x = milToMm(x)
      if (Number.isFinite(y)) y = milToMm(y)
    }
    if (Number.isFinite(x)) xs.push(x)
    if (Number.isFinite(y)) ys.push(y)

    const pkg =
      cellAt(cells, columns.package) ||
      cellAt(cells, columns.description)
    const value = cellAt(cells, columns.value)
    const description = cellAt(cells, columns.description)

    if (
      !designator &&
      !pkg &&
      !value &&
      !description &&
      !Number.isFinite(x) &&
      !Number.isFinite(y)
    ) {
      continue
    }

    const row: CanonicalPickPlaceRow = {
      designator,
      side,
      rawLayer,
      x: Number.isFinite(x) ? x : 0,
      y: Number.isFinite(y) ? y : 0,
      package: pkg,
      value,
      description,
      rotation: columns.rotation >= 0 ? Number(cellAt(cells, columns.rotation)) || 0 : 0,
      mpn: columns.mpn >= 0 ? cellAt(cells, columns.mpn) : '',
    }

    const classified = classifyComponent(row)
    classifiedRows.push(
      applyAutoClassificationReviewGates(
        {
          ...row,
          category: classified.category,
          categoryLabel: classified.categoryLabel,
          confidence: classified.confidence,
          detail: classified.detail,
        },
        { hasLayerColumn },
      ),
    )
  }

  if (!classifiedRows.length) {
    return { ok: false, detail: '실장 데이터 행을 찾을 수 없습니다.' }
  }

  const baseAnalysis: AltiumPickPlaceAnalysis = {
    fileName: fileName || 'pick-place',
    summary: {
      pcbName: pcbNameInfo.name,
      units: detectedUnits === 'unknown' ? 'unknown' : 'mm',
      smtSide: 'single',
      top: emptyLayerStats(),
      bottom: emptyLayerStats(),
      totals: emptyLayerStats(),
      pcbWidthMm: xs.length ? Math.max(...xs) - Math.min(...xs) : 0,
      pcbHeightMm: ys.length ? Math.max(...ys) - Math.min(...ys) : 0,
      skipped: 0,
      dipTotals: emptyPickPlaceDipStats(),
      warnings,
    },
    classifiedRows,
    quoteFields: [],
    certainCount: 0,
    ambiguousCount: 0,
    skippedCount: 0,
  }

  return {
    ok: true,
    analysis: rebuildPickPlaceAnalysis(baseAnalysis, classifiedRows),
  }
}
