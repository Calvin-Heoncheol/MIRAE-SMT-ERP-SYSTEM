import type { SmtBoardForm, DipBoardForm } from '@/lib/quotes/form-state'
import { toNumericField } from '@/lib/quotes/form-state'
import {
  addPickPlaceDipClassification,
  classifyPickPlaceDipFromRow,
  emptyPickPlaceDipStats,
  isPickPlaceDipCategory,
  isPickPlaceSmdCategory,
  pickPlaceCategoryLabel,
  PICK_PLACE_DIP_CATEGORY_OPTIONS,
  PICK_PLACE_MANUAL_CATEGORY_OPTIONS,
  PICK_PLACE_SMD_CATEGORY_OPTIONS,
  type AltiumPickPlaceDipStats,
  type PickPlaceComponentCategory,
} from '@/lib/quotes/pick-place-mount-categories'
import {
  formatPickPlaceSideLabel,
  parsePickPlaceSide,
  type CanonicalPickPlaceRow,
} from '@/lib/quotes/canonical-pick-place'
import { detectPickPlaceHeader } from '@/lib/quotes/pick-place-columns'
import type { SmtSide } from '@/lib/quotes/types'

export function pickAiColumnMappingWarnings(warnings: string[]) {
  return warnings.filter((warning) => warning.startsWith('AI 컬럼 매핑'))
}

export type { CanonicalPickPlaceRow } from '@/lib/quotes/canonical-pick-place'
export type AltiumPickPlaceRow = CanonicalPickPlaceRow

export type { PickPlaceComponentCategory, AltiumPickPlaceDipStats, PickPlaceMountType, PickPlaceDipCategory } from '@/lib/quotes/pick-place-mount-categories'
export {
  PICK_PLACE_DIP_CATEGORY_OPTIONS,
  PICK_PLACE_MANUAL_CATEGORY_OPTIONS,
  PICK_PLACE_SMD_CATEGORY_OPTIONS,
  pickPlaceCategoryLabel,
  suggestPickPlaceDipCategory,
  suggestPickPlaceMountType,
  classifyPickPlaceDipFromRow,
  detectThroughHoleMount,
} from '@/lib/quotes/pick-place-mount-categories'

export type PickPlaceConfidence = 'certain' | 'ambiguous'

export type PickPlaceReviewSource = 'manual' | 'ai' | 'digikey'

export type PickPlaceClassifiedRow = CanonicalPickPlaceRow & {
  category: PickPlaceComponentCategory
  categoryLabel: string
  confidence: PickPlaceConfidence
  detail: string
  reviewSource?: PickPlaceReviewSource
  bomExcluded?: boolean
  bomExcludeReason?: import('@/lib/quotes/bom-dnp').BomExcludeReason
}

export type AltiumPickPlaceLayerStats = {
  partCount: number
  chip: number
  icPin: number
  bga: number
  smtOdd: number
  smtSpecial: number
}

export type AltiumPickPlaceSummary = {
  pcbName: string
  units: 'mm' | 'unknown'
  smtSide: SmtSide
  top: AltiumPickPlaceLayerStats
  bottom: AltiumPickPlaceLayerStats
  totals: AltiumPickPlaceLayerStats
  pcbWidthMm: number
  pcbHeightMm: number
  skipped: number
  dipTotals: AltiumPickPlaceDipStats
  warnings: string[]
}

export type PickPlaceQuoteFieldKey =
  | 'smtSide'
  | 'smtTopCount'
  | 'smtBotCount'
  | 'chip'
  | 'icPin'
  | 'bga'
  | 'smtOdd'
  | 'smtSpecial'
  | 'dipGeneral'
  | 'dipConnector'
  | 'dipWire'
  | 'waveGeneral'
  | 'waveConnector'
  | 'waveWire'

export type PickPlaceQuoteField = {
  key: PickPlaceQuoteFieldKey
  label: string
  displayValue: string
  confidence: PickPlaceConfidence
  note?: string
}

export type AltiumPickPlaceAnalysis = {
  fileName: string
  summary: AltiumPickPlaceSummary
  classifiedRows: PickPlaceClassifiedRow[]
  quoteFields: PickPlaceQuoteField[]
  certainCount: number
  ambiguousCount: number
  skippedCount: number
}

export type AltiumPickPlaceParseResult =
  | { ok: true; analysis: AltiumPickPlaceAnalysis }
  | { ok: false; detail: string }

type Classification = {
  category: PickPlaceComponentCategory
  categoryLabel: string
  confidence: PickPlaceConfidence
  detail: string
  icPins: number
  bgaBalls: number
  countsTowardParts: boolean
}

const CHIP_DESIGNATORS = /^[RCBLF]/i
const PASSIVE_FOOTPRINT =
  /1608|1005|0603|2012|3216|3225|0402|0201|1206|1812|2512|1210|C_1608|R_1608|R_2012|C_2012|C3225|LPS|SOD|FUS|BEAD|SC0201|SC0402|SC0603|SC0805|SC1206/i

function pinCountFromFootprint(footprint: string): { pins: number; confidence: PickPlaceConfidence; note: string } {
  const fp = footprint.trim()
  const fpUpper = fp.toUpperCase()

  const suffix = fp.match(/-(\d+)N\b/i)
  if (suffix) {
    return { pins: Math.max(0, Number(suffix[1]) || 0), confidence: 'certain', note: `${suffix[1]}핀` }
  }

  const qfp = fp.match(/(\d+)(?:LQFP|VQFPN|VFQFPN|TQFP|QFP)/i)
  if (qfp) {
    return { pins: Math.max(0, Number(qfp[1]) || 0), confidence: 'certain', note: `QFP ${qfp[1]}핀` }
  }

  if (/^DBV/i.test(fp) || /DBV\d{4}/i.test(fp)) {
    return { pins: 5, confidence: 'certain', note: 'SOT-23-5' }
  }
  if (/^DGK/i.test(fp)) {
    return { pins: 8, confidence: 'certain', note: 'MSOP-8 (DGK)' }
  }
  if (/^SO8/i.test(fp) || /^SOIC.*8/i.test(fpUpper)) {
    return { pins: 8, confidence: 'certain', note: 'SO-8' }
  }
  if (/SOT23-6/i.test(fp)) {
    return { pins: 6, confidence: 'certain', note: 'SOT-23-6' }
  }
  if (/SOT65P220X100-3/i.test(fp)) {
    return { pins: 3, confidence: 'certain', note: 'SOT-3' }
  }
  if (/FP-MSE-12-05/i.test(fp)) {
    return { pins: 8, confidence: 'certain', note: 'DC-DC 8핀' }
  }
  if (/TXB_IC/i.test(fp)) {
    return { pins: 8, confidence: 'certain', note: 'IC 8핀' }
  }
  if (/ATS8001|ATS7001/i.test(fp)) {
    return { pins: 8, confidence: 'certain', note: '전원 IC 8핀' }
  }

  const sot = fp.match(/SOT23-(\d+)/i)
  if (sot) return { pins: Math.max(0, Number(sot[1]) || 0), confidence: 'certain', note: `SOT-23-${sot[1]}` }
  const so = fp.match(/SO(\d+)_/i)
  if (so) return { pins: Math.max(0, Number(so[1]) || 0), confidence: 'certain', note: `SO-${so[1]}` }
  if (/SOT/i.test(fp)) return { pins: 3, confidence: 'certain', note: 'SOT-3' }

  return { pins: 8, confidence: 'ambiguous', note: 'IC · 핀수 추정' }
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

function rowsFromText(text: string): string[][] {
  const normalized = text.replace(/^\uFEFF/, '')
  return normalized
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => parseCsvLine(line))
}

function extractPcbName(text: string, fileName?: string) {
  const boardRev = text.match(/BDA-V\d+\.\d+/i)
  if (boardRev?.[0]) return { name: boardRev[0], confidence: 'certain' as const }

  if (fileName) {
    const stem = fileName.replace(/\.[^.]+$/, '').trim()
    if (stem) return { name: stem, confidence: 'certain' as const }
  }

  const fromPickPlaceParent =
    text.match(/\\([^\\]+)\\Pick Place\\/i) || text.match(/\/([^/]+)\/Pick Place\//i)
  if (fromPickPlaceParent?.[1] && !/^output file$/i.test(fromPickPlaceParent[1])) {
    return { name: fromPickPlaceParent[1].trim(), confidence: 'ambiguous' as const }
  }

  return { name: 'PCB', confidence: 'ambiguous' as const }
}

function extractUnits(text: string, headerRow?: string[]): 'mm' | 'unknown' {
  if (/Units used:\s*mm/i.test(text)) return 'mm'
  if (headerRow?.some((cell) => /\(mm\)/i.test(cell) || /mm$/i.test(cell.trim()))) return 'mm'
  return 'unknown'
}

function cellAt(cells: string[], index: number) {
  return index >= 0 ? cells[index] || '' : ''
}

function bgaBallCountFromFootprint(footprint: string, description: string) {
  const text = `${footprint} ${description}`
  const direct = text.match(/BGA[^0-9]*(\d{2,4})/i)
  if (direct) {
    return {
      balls: Math.max(0, Number(direct[1]) || 0),
      confidence: 'certain' as const,
      note: `BGA ${direct[1]}볼`,
    }
  }
  return { balls: 0, confidence: 'ambiguous' as const, note: 'BGA · 볼수 확인' }
}

function classifyComponent(row: CanonicalPickPlaceRow): Classification {
  const des = row.designator.trim().toUpperCase()
  const fp = row.package.trim()
  const val = row.value.trim()
  const desc = row.description.trim()
  const fpUpper = fp.toUpperCase()
  const valUpper = val.toUpperCase()
  const descUpper = desc.toUpperCase()
  const textUpper = `${fpUpper} ${valUpper} ${descUpper}`

  if (!des) {
    return {
      category: 'skip',
      categoryLabel: '제외',
      confidence: 'certain',
      detail: '빈 Designator',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: false,
    }
  }
  if (des === 'GND' || des === 'UGND' || des === 'ADGND') {
    return {
      category: 'skip',
      categoryLabel: '제외',
      confidence: 'certain',
      detail: '접지패드 (제외)',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: false,
    }
  }
  if (des.startsWith('TP') || fpUpper.startsWith('TP')) {
    return {
      category: 'skip',
      categoryLabel: '제외',
      confidence: 'certain',
      detail: '테스트포인트 (제외)',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: false,
    }
  }

  const dipClassification = classifyPickPlaceDipFromRow({
    category: 'chip',
    package: fp,
    description: desc,
    value: val,
    designator: des,
    detail: '',
  })
  if (dipClassification) {
    return {
      category: dipClassification.category,
      categoryLabel: pickPlaceCategoryLabel(dipClassification.category),
      confidence: dipClassification.confidence,
      detail: dipClassification.detail,
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (fpUpper.includes('BGA') || descUpper.includes('BGA') || valUpper.includes('BGA')) {
    const bga = bgaBallCountFromFootprint(fp, desc)
    return {
      category: 'bga',
      categoryLabel: 'BGA',
      confidence: bga.confidence,
      detail: bga.note,
      icPins: 0,
      bgaBalls: bga.balls > 0 ? bga.balls : 1,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('U')) {
    const pin = pinCountFromFootprint(fp)
    return {
      category: 'ic',
      categoryLabel: 'IC',
      confidence: pin.confidence,
      detail: pin.note,
      icPins: pin.pins,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (
    des.startsWith('H') ||
    des.startsWith('CON') ||
    des.startsWith('PS') ||
    descUpper.includes('HEADER') ||
    descUpper.includes('CONN') ||
    descUpper.includes('SOCKET')
  ) {
    return {
      category: 'special',
      categoryLabel: '특수/커넥터',
      confidence: 'ambiguous',
      detail: '커넥터 · SMD/수삽?',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('V') && (des.includes('+') || des.includes('-') || des.includes('GND'))) {
    return {
      category: 'special',
      categoryLabel: '특수/커넥터',
      confidence: 'ambiguous',
      detail: '전원패드 · 실장/제외?',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('Q')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: 'MOSFET/트랜지스터',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('D') && descUpper.includes('LED')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: 'LED',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('D') || fpUpper.includes('SOD') || textUpper.includes('DIODE')) {
    return {
      category: 'chip',
      categoryLabel: 'Chip',
      confidence: 'certain',
      detail: '다이오드',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('OC') || descUpper.includes('OPTO') || descUpper.includes('PHOTOCOUPLER')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: '광절연(옵토커플러)',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('Y') || des.startsWith('XTAL') || descUpper.includes('CRYSTAL') || descUpper.includes('OSC')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: '크리스탈·발진기',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('SW') || descUpper.includes('SWITCH')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: '스위치',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('NTC') || des.startsWith('RT') || descUpper.includes('THERMISTOR')) {
    return {
      category: 'chip',
      categoryLabel: 'Chip',
      confidence: 'certain',
      detail: 'NTC·서미스터',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (CHIP_DESIGNATORS.test(des) || PASSIVE_FOOTPRINT.test(fp) || PASSIVE_FOOTPRINT.test(val)) {
    return {
      category: 'chip',
      categoryLabel: 'Chip',
      confidence: 'certain',
      detail: CHIP_DESIGNATORS.test(des) ? 'R/C/L (위치명)' : '패시브 (풋프린트)',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (CHIP_DESIGNATORS.test(des)) {
    return {
      category: 'chip',
      categoryLabel: 'Chip',
      confidence: 'certain',
      detail: '패시브',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  return {
    category: 'chip',
    categoryLabel: 'Chip',
    confidence: 'ambiguous',
    detail: '분류 불명',
    icPins: 0,
    bgaBalls: 0,
    countsTowardParts: true,
  }
}

export function classifyPickPlaceRow(
  row: CanonicalPickPlaceRow,
  options?: { hasLayerColumn?: boolean },
): PickPlaceClassifiedRow {
  const classified = classifyComponent(row)
  return applyAutoClassificationReviewGates(
    {
      ...row,
      category: classified.category,
      categoryLabel: classified.categoryLabel,
      confidence: classified.confidence,
      detail: classified.detail,
    },
    options,
  )
}

function classificationForStats(row: PickPlaceClassifiedRow): Classification {
  return classificationFromExistingRow(row)
}

export function rebuildPickPlaceAnalysis(
  analysis: AltiumPickPlaceAnalysis,
  classifiedRows: PickPlaceClassifiedRow[],
): AltiumPickPlaceAnalysis {
  const top = emptyLayerStats()
  const bottom = emptyLayerStats()
  const dipTotals = emptyPickPlaceDipStats()
  const partTypeSets = emptyLayerPartTypeSets()
  let skipped = 0
  const xs: number[] = []
  const ys: number[] = []

  for (const row of classifiedRows) {
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

  const sideInfo = inferSmtSide(top, bottom)
  const totals = sumLayerStats(top, bottom)
  const pcbWidthMm = xs.length ? Math.max(...xs) - Math.min(...xs) : analysis.summary.pcbWidthMm
  const pcbHeightMm = ys.length ? Math.max(...ys) - Math.min(...ys) : analysis.summary.pcbHeightMm
  const ambiguousCount = classifiedRows.filter(
    (row) => row.confidence === 'ambiguous' && row.category !== 'skip',
  ).length
  const certainCount = classifiedRows.filter(
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
    classifiedRows,
    quoteFields: buildQuoteFields(summary, classifiedRows, sideInfo),
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

/**
 * SET-UP 종수 키: 같은 부품값/품번 = 1종.
 * 자동 확정은 MPN 또는 (부품값+패키지)만 허용 — 그 외는 사람 검토.
 */
export function pickPlacePartTypeIdentity(row: PickPlaceClassifiedRow): {
  key: string
  certain: boolean
  reason?: string
} {
  const mpn = row.mpn.trim().toUpperCase()
  if (mpn) return { key: `mpn:${mpn}`, certain: true }

  const value = row.value.trim().toUpperCase()
  const pkg = row.package.trim().toUpperCase()
  if (value && pkg) return { key: `vp:${value}|${pkg}`, certain: true }

  if (value) {
    return {
      key: `v:${value}`,
      certain: false,
      reason: '패키지 없음 — 부품값만으로는 종수 확정 불가',
    }
  }
  if (pkg) {
    return {
      key: `p:${pkg}|${row.designator.trim().toUpperCase()}`,
      certain: false,
      reason: '부품값·품번 없음 — 종수 확인 필요',
    }
  }
  return {
    key: `des:${row.designator.trim().toUpperCase()}`,
    certain: false,
    reason: '부품값·품번·패키지 없음 — 종수 확인 필요',
  }
}

export function pickPlacePartTypeKey(row: PickPlaceClassifiedRow) {
  return pickPlacePartTypeIdentity(row).key
}

/**
 * 자동 분류에서 불확실한 항목은 집계하지 않고 사람 검토로 넘긴다.
 * (수동/AI/DigiKey 확정 후에는 reviewSource가 있어 이 게이트를 건너뛴다)
 */
function applyAutoClassificationReviewGates(
  row: PickPlaceClassifiedRow,
  options?: { hasLayerColumn?: boolean },
): PickPlaceClassifiedRow {
  if (row.category === 'skip') return row
  if (row.reviewSource) return row

  let confidence = row.confidence
  let detail = row.detail
  const hasLayerColumn = options?.hasLayerColumn ?? true

  if (hasLayerColumn && row.side === 'unknown') {
    confidence = 'ambiguous'
    if (!detail.includes('면 불명')) detail = `${detail} · 면 불명?`
  }

  // SMD 종수: 품번 또는 부품값+패키지가 없으면 자동 확정 금지 (skip은 위에서 early return)
  if (isPickPlaceSmdCategory(row.category)) {
    const identity = pickPlacePartTypeIdentity(row)
    if (!identity.certain) {
      confidence = 'ambiguous'
      const reason = identity.reason ?? '종수 확인 필요'
      if (!detail.includes(reason) && !detail.includes('종수 확인')) {
        detail = `${detail} · ${reason}`
      }
    }
  }

  // DIP: 약한(위치명만) 수삽 후보는 이미 ambiguous. strong은 유지하되
  // 커넥터류 SMD/수삽 애매는 별도 분류에서 ambiguous 처리됨.

  return { ...row, confidence, detail }
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
      key: 'waveGeneral',
      label: 'WAVE 소형',
      displayValue: String(summary.dipTotals.waveGeneral),
      confidence: fieldConfidence(classifiedRows, ['wave_general']),
    },
    {
      key: 'waveConnector',
      label: 'WAVE 중형',
      displayValue: String(summary.dipTotals.waveConnector),
      confidence: fieldConfidence(classifiedRows, ['wave_connector']),
    },
    {
      key: 'waveWire',
      label: 'WAVE 대형',
      displayValue: String(summary.dipTotals.waveWire),
      confidence: fieldConfidence(classifiedRows, ['wave_wire']),
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
  const units = extractUnits(preamble, header)
  const warnings: string[] = options?.forcedDetection?.note ? [options.forcedDetection.note] : []

  const classifiedRows: PickPlaceClassifiedRow[] = []
  const top = emptyLayerStats()
  const bottom = emptyLayerStats()
  const dipTotals = emptyPickPlaceDipStats()
  const partTypeSets = emptyLayerPartTypeSets()
  let skipped = 0
  const xs: number[] = []
  const ys: number[] = []

  for (let i = headerIndex + 1; i < normalizedRows.length; i += 1) {
    const cells = normalizedRows[i]!
    const designator = cellAt(cells, columns.designator)
    if (!designator) continue

    const rawLayer = hasLayerColumn ? cellAt(cells, columns.layer) : ''
    const side = parsePickPlaceSide(rawLayer, hasLayerColumn)
    const x = Number(cellAt(cells, columns.x))
    const y = Number(cellAt(cells, columns.y))
    if (Number.isFinite(x)) xs.push(x)
    if (Number.isFinite(y)) ys.push(y)

    const pkg =
      cellAt(cells, columns.package) ||
      cellAt(cells, columns.description)
    const value = cellAt(cells, columns.value)
    const description = cellAt(cells, columns.description)

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
      mpn: '',
    }

    const classified = classifyComponent(row)
    const classifiedRow = applyAutoClassificationReviewGates(
      {
        ...row,
        category: classified.category,
        categoryLabel: classified.categoryLabel,
        confidence: classified.confidence,
        detail: classified.detail,
      },
      { hasLayerColumn },
    )
    classifiedRows.push(classifiedRow)

    if (classifiedRow.confidence === 'certain') {
      if (
        !accumulateClassifiedRow(
          classifiedRow,
          {
            ...classified,
            confidence: classifiedRow.confidence,
            detail: classifiedRow.detail,
          },
          top,
          bottom,
          dipTotals,
          partTypeSets,
        )
      ) {
        skipped += 1
      }
    }
  }

  if (!classifiedRows.length) {
    return { ok: false, detail: '실장 데이터 행을 찾을 수 없습니다.' }
  }

  finalizeLayerPartCounts(top, partTypeSets.top)
  finalizeLayerPartCounts(bottom, partTypeSets.bottom)

  const sideInfo = inferSmtSide(top, bottom)
  const smtSide = sideInfo.side
  const totals = sumLayerStats(top, bottom)
  const pcbWidthMm = xs.length ? Math.max(...xs) - Math.min(...xs) : 0
  const pcbHeightMm = ys.length ? Math.max(...ys) - Math.min(...ys) : 0

  const ambiguousCount = classifiedRows.filter(
    (row) => row.confidence === 'ambiguous' && row.category !== 'skip',
  ).length
  const certainCount = classifiedRows.filter(
    (row) => row.confidence === 'certain' && row.category !== 'skip',
  ).length

  const summary: AltiumPickPlaceSummary = {
    pcbName: pcbNameInfo.name,
    units,
    smtSide,
    top,
    bottom,
    totals,
    pcbWidthMm,
    pcbHeightMm,
    skipped,
    dipTotals,
    warnings,
  }

  const quoteFields = buildQuoteFields(summary, classifiedRows, sideInfo)

  return {
    ok: true,
    analysis: {
      fileName: fileName || 'pick-place',
      summary,
      classifiedRows,
      quoteFields,
      certainCount,
      ambiguousCount,
      skippedCount: skipped,
    },
  }
}

export function parseAltiumPickPlaceCsv(text: string, fileName?: string): AltiumPickPlaceParseResult {
  return parsePickPlaceRows(rowsFromText(text), fileName)
}

export function applyAltiumPickPlaceToSmtBoardForm(
  board: SmtBoardForm,
  summary: AltiumPickPlaceSummary,
): SmtBoardForm {
  const { totals, top, bottom, smtSide, pcbName } = summary
  return {
    ...board,
    pcbName: pcbName || board.pcbName,
    chip: toNumericField(totals.chip),
    icPin: toNumericField(totals.icPin),
    bga: toNumericField(totals.bga),
    smtOdd: toNumericField(totals.smtOdd),
    smtSpecial: toNumericField(totals.smtSpecial),
    smtSide,
    smtTopCount: toNumericField(top.partCount),
    smtBotCount: toNumericField(smtSide === 'single' ? 0 : bottom.partCount),
  }
}

export function applyAltiumPickPlaceToDipBoardForm(
  board: DipBoardForm,
  summary: AltiumPickPlaceSummary,
): DipBoardForm {
  const dipTotals = summary.dipTotals ?? emptyPickPlaceDipStats()
  return {
    ...board,
    pcbName: summary.pcbName || board.pcbName,
    dipGeneral: toNumericField(dipTotals.dipGeneral),
    dipConnector: toNumericField(dipTotals.dipConnector),
    dipWire: toNumericField(dipTotals.dipWire),
    waveGeneral: toNumericField(dipTotals.waveGeneral),
    waveConnector: toNumericField(dipTotals.waveConnector),
    waveWire: toNumericField(dipTotals.waveWire),
  }
}

export function formatAltiumPickPlaceSummary(summary: AltiumPickPlaceSummary) {
  const { totals, top, bottom, smtSide, pcbWidthMm, pcbHeightMm } = summary
  const sideLabel = smtSideLabel(smtSide)
  return [
    `PCB ${summary.pcbName} · ${sideLabel}`,
    `실장 ${totals.partCount}종 (TOP ${top.partCount} / BOT ${bottom.partCount})`,
    `chip ${totals.chip} · IC pin ${totals.icPin} · BGA ${totals.bga} · 특수 ${totals.smtSpecial} · 이형 ${totals.smtOdd}`,
    pcbWidthMm > 0 && pcbHeightMm > 0
      ? `크기 약 ${pcbWidthMm.toFixed(1)} × ${pcbHeightMm.toFixed(1)} mm`
      : null,
  ]
    .filter(Boolean)
    .join(' · ')
}

export const PICK_PLACE_CONFIDENCE_STYLES = {
  certain: {
    badge: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
    row: 'bg-emerald-50/80',
    card: 'border-emerald-200 bg-emerald-50/60',
  },
  ambiguous: {
    badge: 'bg-amber-100 text-amber-900 ring-amber-200',
    row: 'bg-amber-50/90',
    card: 'border-amber-200 bg-amber-50/70',
  },
} as const

export function pickPlaceConfidenceLabel(confidence: PickPlaceConfidence) {
  return confidence === 'certain' ? '확인됨' : '검토 필요'
}

export type PickPlaceManualOverride = {
  category: PickPlaceComponentCategory
  icPinCount?: number
  bgaBallCount?: number
  source?: 'manual' | 'ai' | 'digikey'
  aiReason?: string
}

export function suggestIcPinCountForRow(row: PickPlaceClassifiedRow) {
  return pinCountFromFootprint(row.package).pins
}

export function suggestBgaBallCountForRow(row: PickPlaceClassifiedRow) {
  return bgaBallCountFromFootprint(row.package, row.description).balls
}

function classificationFromExistingRow(row: PickPlaceClassifiedRow): Classification {
  if (row.category === 'skip') {
    return {
      category: 'skip',
      categoryLabel: row.categoryLabel,
      confidence: row.confidence,
      detail: row.detail,
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: false,
    }
  }
  if (row.category === 'ic') {
    const pin = pinCountFromFootprint(row.package)
    return {
      category: 'ic',
      categoryLabel: row.categoryLabel,
      confidence: row.confidence,
      detail: row.detail,
      icPins: pin.pins > 0 ? pin.pins : 1,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }
  if (row.category === 'bga') {
    const bga = bgaBallCountFromFootprint(row.package, row.description)
    return {
      category: 'bga',
      categoryLabel: row.categoryLabel,
      confidence: row.confidence,
      detail: row.detail,
      icPins: 0,
      bgaBalls: bga.balls > 0 ? bga.balls : 1,
      countsTowardParts: true,
    }
  }
  return {
    category: row.category,
    categoryLabel: row.categoryLabel,
    confidence: row.confidence,
    detail: row.detail,
    icPins: 0,
    bgaBalls: 0,
    countsTowardParts: true,
  }
}

function buildManualClassification(
  row: PickPlaceClassifiedRow,
  override: PickPlaceManualOverride,
): Classification {
  const reason = override.aiReason?.trim()

  if (override.category === 'skip') {
    return {
      category: 'skip',
      categoryLabel: '제외',
      confidence: 'certain',
      detail: reason || '제외',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: false,
    }
  }
  if (override.category === 'chip') {
    return {
      category: 'chip',
      categoryLabel: 'Chip',
      confidence: 'certain',
      detail: reason || '패시브',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }
  if (override.category === 'ic') {
    const pins = override.icPinCount ?? suggestIcPinCountForRow(row)
    const pinCount = pins > 0 ? pins : 1
    return {
      category: 'ic',
      categoryLabel: 'IC',
      confidence: 'certain',
      detail: reason || `IC ${pinCount}핀`,
      icPins: pinCount,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }
  if (override.category === 'bga') {
    const balls = override.bgaBallCount ?? suggestBgaBallCountForRow(row)
    const ballCount = balls > 0 ? balls : 1
    return {
      category: 'bga',
      categoryLabel: 'BGA',
      confidence: 'certain',
      detail: reason || `BGA ${ballCount}볼`,
      icPins: 0,
      bgaBalls: ballCount,
      countsTowardParts: true,
    }
  }
  if (override.category === 'odd') {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: reason || '이형',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }
  if (isPickPlaceDipCategory(override.category)) {
    return {
      category: override.category,
      categoryLabel: pickPlaceCategoryLabel(override.category),
      confidence: 'certain',
      detail: reason || pickPlaceCategoryLabel(override.category),
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }
  return {
    category: 'special',
    categoryLabel: '특수/커넥터',
    confidence: 'certain',
    detail: reason || '커넥터',
    icPins: 0,
    bgaBalls: 0,
    countsTowardParts: true,
  }
}

export function buildPickPlaceRowKey(row: PickPlaceClassifiedRow, index: number) {
  return `${index}|${row.designator}|${row.side}|${row.x}|${row.y}`
}

function resolvePickPlaceManualOverride(
  row: PickPlaceClassifiedRow,
  index: number,
  overrides: Record<string, PickPlaceManualOverride>,
) {
  return (
    overrides[buildPickPlaceRowKey(row, index)] ??
    overrides[row.designator.toUpperCase()] ??
    overrides[row.designator]
  )
}

export function applyPickPlaceManualOverrides(
  analysis: AltiumPickPlaceAnalysis,
  overrides: Record<string, PickPlaceManualOverride>,
): AltiumPickPlaceAnalysis {
  if (!Object.keys(overrides).length) return analysis

  const top = emptyLayerStats()
  const bottom = emptyLayerStats()
  const dipTotals = emptyPickPlaceDipStats()
  const partTypeSets = emptyLayerPartTypeSets()
  let skipped = 0

  const classifiedRows = analysis.classifiedRows.map((row, index) => {
    const override = resolvePickPlaceManualOverride(row, index, overrides)
    if (!override) return row

    const classified = buildManualClassification(row, override)
    return {
      ...row,
      category: classified.category,
      categoryLabel: classified.categoryLabel,
      confidence: 'certain' as const,
      detail: classified.detail,
      reviewSource: override.source ?? 'manual',
    }
  })

  for (const [index, row] of classifiedRows.entries()) {
    if (!rowCountsTowardQuoteTotals(row)) continue

    const override = resolvePickPlaceManualOverride(analysis.classifiedRows[index] ?? row, index, overrides)
    const sourceRow = analysis.classifiedRows[index] ?? row
    const classified = override
      ? buildManualClassification(sourceRow, override)
      : classificationFromExistingRow(row)

    if (!accumulateClassifiedRow(row, classified, top, bottom, dipTotals, partTypeSets)) {
      skipped += 1
    }
  }

  finalizeLayerPartCounts(top, partTypeSets.top)
  finalizeLayerPartCounts(bottom, partTypeSets.bottom)

  const sideInfo = inferSmtSide(top, bottom)
  const totals = sumLayerStats(top, bottom)
  const ambiguousCount = classifiedRows.filter(
    (row) => row.confidence === 'ambiguous' && row.category !== 'skip',
  ).length
  const certainCount = classifiedRows.filter(
    (row) => row.confidence === 'certain' && row.category !== 'skip',
  ).length

  const warnings = pickAiColumnMappingWarnings(analysis.summary.warnings)

  const summary: AltiumPickPlaceSummary = {
    ...analysis.summary,
    smtSide: sideInfo.side,
    top,
    bottom,
    totals,
    skipped,
    dipTotals,
    warnings,
  }

  const quoteFields = buildQuoteFields(summary, classifiedRows, sideInfo)

  return {
    ...analysis,
    summary,
    classifiedRows,
    quoteFields,
    certainCount,
    ambiguousCount,
    skippedCount: skipped,
  }
}
