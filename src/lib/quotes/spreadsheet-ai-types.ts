import type { BomColumnMap } from '@/lib/quotes/bom-columns'
import type { PickPlaceColumnMap } from '@/lib/quotes/pick-place-columns'

export type SpreadsheetAiFileKind = 'pickplace' | 'bom'

export type SpreadsheetAiPickPlacePayload = {
  headerRowIndex: number
  columns: {
    designator: string
    x: string
    y: string
    layer?: string | null
    package?: string | null
    value?: string | null
    footprint?: string | null
    comment?: string | null
    rotation?: string | null
    mpn?: string | null
  }
}

export type SpreadsheetAiBomPayload = {
  headerRowIndex: number
  columns: {
    designator: string
    comment?: string | null
    footprint?: string | null
    description?: string | null
    quantity?: string | null
    mpn?: string | null
    manufacturer?: string | null
    supplier?: string | null
    supplierPart?: string | null
  }
}

export type SpreadsheetAiDetection =
  | { fileKind: 'pickplace'; headerIndex: number; columns: PickPlaceColumnMap; note: string }
  | { fileKind: 'bom'; headerIndex: number; columns: BomColumnMap; note: string }

export type InferSpreadsheetColumnsResult =
  | { ok: true; detection: SpreadsheetAiDetection }
  | { ok: false; detail: string }
