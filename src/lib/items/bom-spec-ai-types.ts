import type { ItemMaterialType } from '@/lib/items/types'

export type BomSpecAiRowInput = {
  /** 품목코드(CPN) — 결과 매칭 키 */
  code: string
  name: string
  specification: string
  package: string
  mpn: string
  materialType: ItemMaterialType | ''
}

export type BomSpecAiSplit = {
  code: string
  specification: string
  package: string
  mpn: string
  materialType?: ItemMaterialType
  reason: string
}

export type SplitBomSpecsResult =
  | { ok: true; splits: BomSpecAiSplit[]; processedCount: number }
  | { ok: false; detail: string }
