import type { BomFormLine } from '@/lib/bom/form-state'
import { explodeDesignators } from '@/lib/quotes/designator-utils'

export type BomDesignatorQtyIssue = {
  designatorCount: number
  quantity: number
}

/** Designator 개수와 Qty 불일치 — Designator 가 비어 있거나 Qty 가 숫자가 아니면 검사하지 않음 */
export function bomDesignatorQtyIssue(line: BomFormLine): BomDesignatorQtyIssue | null {
  if (!line.designators.trim()) return null
  const quantity = Number(line.quantityPer.trim())
  if (!line.quantityPer.trim() || !Number.isFinite(quantity)) return null
  const designatorCount = explodeDesignators(line.designators).length
  if (designatorCount === quantity) return null
  return { designatorCount, quantity }
}

export function countBomDesignatorQtyIssues(lines: BomFormLine[]) {
  return lines.filter((line) => bomDesignatorQtyIssue(line)).length
}
