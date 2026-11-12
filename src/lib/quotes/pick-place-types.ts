import {
  type AltiumPickPlaceDipStats,
  type PickPlaceComponentCategory,
} from '@/lib/quotes/pick-place-mount-categories'
import { type CanonicalPickPlaceRow } from '@/lib/quotes/canonical-pick-place'
import type { SmtSide } from '@/lib/quotes/types'

export type AltiumPickPlaceRow = CanonicalPickPlaceRow

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
  | 'dipXLarge'

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
