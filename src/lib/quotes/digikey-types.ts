import type { PickPlaceComponentCategory } from '@/lib/quotes/parse-altium-pick-place'

export type PickPlaceDigiKeyRowInput = {
  designator: string
  mpn: string
  manufacturer?: string
  package: string
  value: string
  description: string
  currentCategory: PickPlaceComponentCategory
}

export type PickPlaceDigiKeyClassification = {
  designator: string
  category: PickPlaceComponentCategory
  icPinCount?: number
  bgaBallCount?: number
  reason: string
  mpn: string
  digiKeyPartNumber?: string
}

export type ClassifyPickPlaceWithDigiKeyResult =
  | { ok: true; classifications: PickPlaceDigiKeyClassification[]; skipped: string[] }
  | { ok: false; detail: string }
