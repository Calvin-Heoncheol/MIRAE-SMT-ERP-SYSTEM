import { looksPacked } from '@/lib/bom/ai-classify'
import type { ItemFormState } from '@/lib/items/form-state'
import type { BomSpecAiRowInput } from '@/lib/items/bom-spec-ai-types'

/** 사양 한 칸에 패키지·MPN이 섞인 ERP BOM 스타일인지 */
export function looksLikePackedBomSpec(row: {
  specification: string
  package: string
  mpn: string
}) {
  const spec = row.specification.trim()
  if (!spec) return false
  if (row.package.trim() && row.mpn.trim()) return false
  if (/[,，;|]/.test(spec)) return true
  // 0402 / 47pF / GJM1551… 등이 한 문자열에 섞인 경우
  if (/\b0\d{3}\b/.test(spec) && /[A-Z]{2,}\d+/i.test(spec)) return true
  return false
}

/** 품목명·사양에 값이 섞였거나 MPN 이 비어 있는 행 (BOM 등록 AI 분류와 같은 기준) */
export function toBomSpecAiRowInput(row: ItemFormState): BomSpecAiRowInput | null {
  const code = row.id.trim()
  if (!code) return null
  const name = row.name.trim()
  const spec = row.specification.trim()
  if (!name && !spec) return null
  const packed =
    looksPacked(name) ||
    looksPacked(spec) ||
    looksLikePackedBomSpec({ specification: spec, package: row.package, mpn: row.mpn })
  if (!packed && row.mpn.trim()) return null
  return {
    code,
    name: row.name.trim(),
    specification: row.specification.trim(),
    package: row.package.trim(),
    mpn: row.mpn.trim(),
    materialType: row.materialType || '',
  }
}

export function collectBomSpecAiRows(rows: ItemFormState[]): BomSpecAiRowInput[] {
  const seen = new Set<string>()
  const result: BomSpecAiRowInput[] = []
  for (const row of rows) {
    const input = toBomSpecAiRowInput(row)
    if (!input) continue
    const key = input.code.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    result.push(input)
  }
  return result
}
