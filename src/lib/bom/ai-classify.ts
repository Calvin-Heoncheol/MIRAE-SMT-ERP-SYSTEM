import { rematchBomFormLine } from '@/lib/bom/bulk-paste'
import type { BomFormLine } from '@/lib/bom/form-state'
import type { BomSpecAiRowInput, BomSpecAiSplit } from '@/lib/items/bom-spec-ai-types'
import type { Item } from '@/lib/items/types'

const PACKED_SEPARATOR = /[,，;|/]/

export function looksPacked(value: string) {
  const text = value.trim()
  if (!text) return false
  if (PACKED_SEPARATOR.test(text)) return true
  return text.split(/\s+/).length >= 3
}

/** 미매칭 행 중 품목명·규격에 값/MPN이 섞였거나 MPN이 비어 있는 행 */
export function needsBomAiClassify(line: BomFormLine) {
  if (line.childProductId.trim()) return false
  const name = line.sourceName.trim()
  const spec = line.sourceSpec.trim()
  if (!name && !spec) return false
  if (looksPacked(name) || looksPacked(spec)) return true
  return !line.sourceMpn.trim()
}

export function toBomAiRows(lines: BomFormLine[]): BomSpecAiRowInput[] {
  return lines.filter(needsBomAiClassify).map((line) => ({
    code: line.key,
    name: line.sourceName.trim(),
    specification: line.sourceSpec.trim(),
    package: '',
    mpn: line.sourceMpn.trim(),
    materialType:
      line.process === 'smd' ? 'SMD' : line.process === 'dip' ? 'DIP' : '',
  }))
}

/** BOM 표에는 패키지 칸이 없어 규격 끝에 붙임 */
function joinSpecAndPackage(specification: string, pkg: string) {
  const spec = specification.trim()
  const packageText = pkg.trim()
  if (!packageText) return spec
  if (!spec) return packageText
  if (spec.toLowerCase().includes(packageText.toLowerCase())) return spec
  return `${spec}, ${packageText}`
}

export function fallbackShortName(name: string) {
  const first = name.split(PACKED_SEPARATOR)[0]?.trim() || name.trim()
  return first.split(/\s+/)[0] || first
}

export type ApplyBomAiResult = {
  lines: BomFormLine[]
  classifiedCount: number
  mpnFilledCount: number
  matchedCount: number
}

export function applyBomAiSplits(
  lines: BomFormLine[],
  splits: BomSpecAiSplit[],
  childItems: Item[],
): ApplyBomAiResult {
  const byKey = new Map(splits.map((split) => [split.code, split]))
  let classifiedCount = 0
  let mpnFilledCount = 0
  let matchedCount = 0

  const next = lines.map((line) => {
    const split = byKey.get(line.key)
    if (!split) return line
    classifiedCount += 1

    const hadMpn = Boolean(line.sourceMpn.trim())
    const nameWasPacked = looksPacked(line.sourceName)
    const patched: BomFormLine = {
      ...line,
      sourceName:
        split.name.trim() || (nameWasPacked ? fallbackShortName(line.sourceName) : line.sourceName),
      sourceSpec: joinSpecAndPackage(split.specification, split.package),
      sourceMpn: split.mpn.trim() || line.sourceMpn,
      process:
        line.process ||
        (split.materialType === 'SMD' ? 'smd' : split.materialType === 'DIP' ? 'dip' : line.process),
    }
    if (!hadMpn && patched.sourceMpn.trim()) mpnFilledCount += 1

    const rematched = rematchBomFormLine(patched, childItems)
    if (rematched.childProductId) matchedCount += 1
    return rematched
  })

  return { lines: next, classifiedCount, mpnFilledCount, matchedCount }
}
