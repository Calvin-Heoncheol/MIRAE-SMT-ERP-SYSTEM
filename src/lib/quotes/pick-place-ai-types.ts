import type { PickPlaceComponentCategory } from '@/lib/quotes/parse-altium-pick-place'
import type { PickPlaceSide } from '@/lib/quotes/canonical-pick-place'

export type PickPlaceAiRowInput = {
  designator: string
  side: PickPlaceSide
  package: string
  value: string
  description: string
  mpn: string
  currentCategory: PickPlaceComponentCategory
  currentDetail: string
}

export type PickPlaceAiClassification = {
  designator: string
  category: PickPlaceComponentCategory
  icPinCount?: number
  bgaBallCount?: number
  reason: string
}

export type ClassifyPickPlaceRowsResult =
  | { ok: true; classifications: PickPlaceAiClassification[] }
  | { ok: false; detail: string }
