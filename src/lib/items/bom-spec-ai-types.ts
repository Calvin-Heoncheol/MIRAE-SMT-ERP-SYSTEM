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
  /** 값·MPN을 뺀 짧은 품목명 (C, R, IC …). 판단 못 하면 빈 문자열 */
  name: string
  specification: string
  package: string
  mpn: string
  materialType?: ItemMaterialType
  reason: string
}

export type SplitBomSpecsResult =
  | { ok: true; splits: BomSpecAiSplit[]; processedCount: number }
  | { ok: false; detail: string }
