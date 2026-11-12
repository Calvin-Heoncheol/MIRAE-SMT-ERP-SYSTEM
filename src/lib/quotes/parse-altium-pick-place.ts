import type { SmtBoardForm, DipBoardForm } from '@/lib/quotes/form-state'
import { toNumericField } from '@/lib/quotes/form-state'
import {
  emptyPickPlaceDipStats,
  isPickPlaceDipCategory,
  pickPlaceCategoryLabel,
  type PickPlaceComponentCategory,
} from '@/lib/quotes/pick-place-mount-categories'
import type {
  AltiumPickPlaceAnalysis,
  AltiumPickPlaceSummary,
  PickPlaceClassifiedRow,
  PickPlaceConfidence,
} from './pick-place-types'
import {
  bgaBallCountFromFootprint,
  pinCountFromFootprint,
  type Classification,
} from './pick-place-classify'
import { rebuildPickPlaceAnalysis } from './pick-place-analysis'

export {
  type AltiumPickPlaceAnalysis,
  type AltiumPickPlaceLayerStats,
  type AltiumPickPlaceParseResult,
  type AltiumPickPlaceRow,
  type AltiumPickPlaceSummary,
  type PickPlaceClassifiedRow,
  type PickPlaceConfidence,
  type PickPlaceQuoteField,
  type PickPlaceQuoteFieldKey,
  type PickPlaceReviewSource,
} from './pick-place-types'
export { classifyPickPlaceRow, pickPlacePartTypeIdentity } from './pick-place-classify'
export { parsePickPlaceRows, rebuildPickPlaceAnalysis } from './pick-place-analysis'

export function pickAiColumnMappingWarnings(warnings: string[]) {
  return warnings.filter((warning) => warning.startsWith('AI 컬럼 매핑'))
}

export type { CanonicalPickPlaceRow } from '@/lib/quotes/canonical-pick-place'

export type {
  PickPlaceComponentCategory,
  AltiumPickPlaceDipStats,
  PickPlaceMountType,
  PickPlaceDipCategory,
} from '@/lib/quotes/pick-place-mount-categories'
export {
  PICK_PLACE_DIP_CATEGORY_OPTIONS,
  PICK_PLACE_MANUAL_CATEGORY_OPTIONS,
  PICK_PLACE_SMD_CATEGORY_OPTIONS,
  pickPlaceCategoryLabel,
  pickPlaceProcessHint,
  pickPlaceProcessLabel,
  suggestPickPlaceDipCategory,
  suggestPickPlaceMountType,
  classifyPickPlaceDipFromRow,
  detectThroughHoleMount,
} from '@/lib/quotes/pick-place-mount-categories'

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
    dipXLarge: toNumericField(dipTotals.dipXLarge),
  }
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

  const warnings = pickAiColumnMappingWarnings(analysis.summary.warnings)

  return rebuildPickPlaceAnalysis(
    { ...analysis, summary: { ...analysis.summary, warnings } },
    classifiedRows,
  )
}
