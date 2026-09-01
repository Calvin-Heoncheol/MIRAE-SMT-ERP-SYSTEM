import type { BomColumnMap } from '@/lib/quotes/bom-columns'
import { fillMissingBomColumns, formatBomColumnMappingNote } from '@/lib/quotes/bom-columns'
import { fillMissingPickPlaceColumns, formatPickPlaceColumnMappingNote, type PickPlaceColumnMap } from '@/lib/quotes/pick-place-columns'
import type {
  SpreadsheetAiBomPayload,
  SpreadsheetAiPickPlacePayload,
} from '@/lib/quotes/spreadsheet-ai-types'

function normalizeHeaderKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\w가-힣]+/g, '')
    .trim()
}

export function findHeaderColumnByName(header: string[], headerName?: string | null) {
  const target = String(headerName ?? '').trim()
  if (!target) return -1

  const exact = header.findIndex((cell) => cell.trim() === target)
  if (exact >= 0) return exact

  const normalizedTarget = normalizeHeaderKey(target)
  if (!normalizedTarget) return -1

  return header.findIndex((cell) => {
    const key = normalizeHeaderKey(cell)
    return key === normalizedTarget || key.includes(normalizedTarget) || normalizedTarget.includes(key)
  })
}

export function resolvePickPlaceColumnsFromAi(
  rows: string[][],
  payload: SpreadsheetAiPickPlacePayload,
): { headerIndex: number; columns: PickPlaceColumnMap; note: string } | null {
  const headerIndex = payload.headerRowIndex
  const header = rows[headerIndex]
  if (!header) return null

  const designator = findHeaderColumnByName(header, payload.columns.designator)
  const x = findHeaderColumnByName(header, payload.columns.x)
  const y = findHeaderColumnByName(header, payload.columns.y)
  if (designator < 0 || x < 0 || y < 0) return null

  const aiColumns: PickPlaceColumnMap = {
    designator,
    x,
    y,
    layer: findHeaderColumnByName(header, payload.columns.layer),
    package: findHeaderColumnByName(
      header,
      payload.columns.package ?? payload.columns.footprint,
    ),
    value: findHeaderColumnByName(header, payload.columns.value ?? payload.columns.comment),
    rotation: findHeaderColumnByName(header, payload.columns.rotation),
    description: findHeaderColumnByName(header, payload.columns.description),
    mpn: findHeaderColumnByName(header, payload.columns.mpn),
  }
  const columns = fillMissingPickPlaceColumns(header, aiColumns)

  return {
    headerIndex,
    columns,
    note: formatPickPlaceColumnMappingNote(header, columns),
  }
}

export function resolveBomColumnsFromAi(
  rows: string[][],
  payload: SpreadsheetAiBomPayload,
): { headerIndex: number; columns: BomColumnMap; note: string } | null {
  const headerIndex = payload.headerRowIndex
  const header = rows[headerIndex]
  if (!header) return null

  const designator = findHeaderColumnByName(header, payload.columns.designator)
  if (designator < 0) return null

  const aiColumns: BomColumnMap = {
    designator,
    comment: findHeaderColumnByName(header, payload.columns.comment),
    footprint: findHeaderColumnByName(header, payload.columns.footprint),
    description: findHeaderColumnByName(header, payload.columns.description),
    quantity: findHeaderColumnByName(header, payload.columns.quantity),
    mpn: findHeaderColumnByName(header, payload.columns.mpn),
    manufacturer: findHeaderColumnByName(header, payload.columns.manufacturer),
    supplier: findHeaderColumnByName(header, payload.columns.supplier),
    supplierPart: findHeaderColumnByName(header, payload.columns.supplierPart),
  }
  const columns = fillMissingBomColumns(header, rows, headerIndex, aiColumns)

  const hasValueColumn =
    columns.comment >= 0 ||
    columns.footprint >= 0 ||
    columns.description >= 0 ||
    columns.mpn >= 0
  if (!hasValueColumn) return null

  return {
    headerIndex,
    columns,
    note: formatBomColumnMappingNote(header, columns),
  }
}

export function buildSpreadsheetPreviewText(rows: string[][], maxRows = 12) {
  return rows
    .slice(0, maxRows)
    .map((row, index) => `${index}\t${row.map((cell) => cell.replace(/\s+/g, ' ').trim()).join('\t')}`)
    .join('\n')
}
