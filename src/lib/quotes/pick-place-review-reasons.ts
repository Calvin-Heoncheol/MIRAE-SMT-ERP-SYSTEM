import {
  isPickPlaceDipCategory,
  suggestPickPlaceMountType,
} from '@/lib/quotes/pick-place-mount-categories'
import type { PickPlaceClassifiedRow } from '@/lib/quotes/parse-altium-pick-place'

export type PickPlaceReviewReasonTag =
  | 'mpn_missing'
  | 'designator_missing'
  | 'designator_duplicate'
  | 'side_unknown'
  | 'dip_candidate'
  | 'part_type_uncertain'
  | 'classification_uncertain'

export const PICK_PLACE_REVIEW_REASON_LABELS: Record<PickPlaceReviewReasonTag, string> = {
  mpn_missing: 'MPN 없음',
  designator_missing: 'Designator 없음',
  designator_duplicate: 'Designator 중복',
  side_unknown: '면 불명',
  dip_candidate: '수삽 후보',
  part_type_uncertain: '종수 불명',
  classification_uncertain: '분류 불명',
}

/** 적용 차단 없이 확인만 하면 되는 사유 */
export const NON_BLOCKING_PICK_PLACE_REVIEW_TAGS = new Set<PickPlaceReviewReasonTag>([
  'designator_duplicate',
])

export function getPickPlaceReviewReasonTags(row: PickPlaceClassifiedRow): PickPlaceReviewReasonTag[] {
  if (row.category === 'skip') return []
  if (row.confidence !== 'ambiguous') return []

  const tags = new Set<PickPlaceReviewReasonTag>()
  const detail = row.detail

  if (detail.includes('MPN 없음')) tags.add('mpn_missing')
  if (detail.includes('Designator 없음')) tags.add('designator_missing')
  if (detail.includes('Designator 중복')) tags.add('designator_duplicate')
  if (detail.includes('면 불명')) tags.add('side_unknown')
  if (
    detail.includes('수삽') ||
    detail.includes('DIP') ||
    (!isPickPlaceDipCategory(row.category) &&
      suggestPickPlaceMountType({
        category: row.category,
        package: row.package,
        description: row.description,
        value: row.value,
        designator: row.designator,
        detail: row.detail,
      }) === 'dip')
  ) {
    tags.add('dip_candidate')
  }
  if (
    detail.includes('종수 확인') ||
    detail.includes('패키지 없음') ||
    detail.includes('부품값·품번')
  ) {
    tags.add('part_type_uncertain')
  }
  if (!tags.size) tags.add('classification_uncertain')

  return [...tags]
}

export function hasBlockingPickPlaceReview(row: PickPlaceClassifiedRow): boolean {
  if (row.confidence !== 'ambiguous' || row.category === 'skip') return false
  const tags = getPickPlaceReviewReasonTags(row)
  return tags.some((tag) => !NON_BLOCKING_PICK_PLACE_REVIEW_TAGS.has(tag))
}

export function isDuplicateOnlyPickPlaceReview(row: PickPlaceClassifiedRow): boolean {
  if (row.confidence !== 'ambiguous' || row.category === 'skip') return false
  const tags = getPickPlaceReviewReasonTags(row)
  return tags.length > 0 && tags.every((tag) => tag === 'designator_duplicate')
}

export function countBlockingPickPlaceReviews(rows: PickPlaceClassifiedRow[]) {
  return rows.filter(hasBlockingPickPlaceReview).length
}

export function countDuplicateOnlyPickPlaceReviews(rows: PickPlaceClassifiedRow[]) {
  return rows.filter(isDuplicateOnlyPickPlaceReview).length
}

export function summarizePickPlaceReviewReasons(rows: PickPlaceClassifiedRow[]) {
  const counts = new Map<PickPlaceReviewReasonTag, number>()
  for (const row of rows) {
    if (row.category === 'skip' || row.confidence !== 'ambiguous') continue
    for (const tag of getPickPlaceReviewReasonTags(row)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1)
    }
  }
  return [...counts.entries()]
    .map(([tag, count]) => ({ tag, count, label: PICK_PLACE_REVIEW_REASON_LABELS[tag] }))
    .sort((a, b) => b.count - a.count)
}

export function isPickPlaceDigiKeyEligible(row: PickPlaceClassifiedRow) {
  return row.confidence === 'ambiguous' && row.category !== 'skip' && Boolean(row.mpn.trim())
}

export function rowMatchesPickPlaceReviewFilter(
  row: PickPlaceClassifiedRow,
  filter: PickPlaceReviewReasonTag | 'digikey_eligible' | null,
) {
  if (!filter) return true
  if (filter === 'digikey_eligible') return isPickPlaceDigiKeyEligible(row)
  return getPickPlaceReviewReasonTags(row).includes(filter)
}

export function isPickPlaceAnalysisReadyForQuote(rows: PickPlaceClassifiedRow[]) {
  return countBlockingPickPlaceReviews(rows) === 0
}
