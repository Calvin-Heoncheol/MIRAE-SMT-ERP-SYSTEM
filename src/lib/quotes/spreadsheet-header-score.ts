import { scoreBomHeader } from '@/lib/quotes/bom-columns'
import { detectPickPlaceHeader } from '@/lib/quotes/pick-place-columns'

export function scorePickPlaceHeader(rows: string[][]) {
  const detected = detectPickPlaceHeader(rows)
  if (!detected) return 0
  let score = 10
  if (detected.columns.layer >= 0) score += 3
  if (detected.columns.package >= 0) score += 2
  if (detected.columns.value >= 0) score += 2
  return score
}

export function scoreSpreadsheetHeader(rows: string[][]) {
  return Math.max(scorePickPlaceHeader(rows), scoreBomHeader(rows))
}
