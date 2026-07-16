import type { Material } from '@/lib/materials/types'
import { resolveMaterialByInventoryCode } from '@/lib/materials/utils'

export const DIRECT_STOCK_PASTE_COLUMNS = [
  { key: 'materialId', label: '품목코드', required: true },
  { key: 'quantity', label: '수량', required: true },
] as const

export function directStockPasteSampleValues() {
  return ['MR-001', '100']
}

export function directStockPastePlaceholder() {
  const header = DIRECT_STOCK_PASTE_COLUMNS.map((column) => column.label).join('\t')
  const sample = directStockPasteSampleValues().join('\t')
  const sample2 = ['MR-002', '50'].join('\t')
  return `${header}\n${sample}\n${sample2}`
}

function splitPasteColumns(line: string): string[] {
  if (line.includes('\t')) return line.split('\t')
  if (line.includes(',')) return line.split(',')
  return line.split(/\s{2,}/)
}

function isHeaderLine(line: string) {
  const first = (splitPasteColumns(line)[0] || '').trim()
  if (!first) return false
  if (/^품목코드$/i.test(first)) return true
  return DIRECT_STOCK_PASTE_COLUMNS.some((column) => column.label === first)
}

export type DirectStockPasteRow = {
  materialId: string
  quantity: string
}

/** Excel 복사본 → 행 파싱 (품목코드 / 수량) */
export function parseDirectStockBulkPaste(text: string): DirectStockPasteRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())

  if (!lines.length) return []

  const startIndex = isHeaderLine(lines[0]) ? 1 : 0
  const rows: DirectStockPasteRow[] = []

  for (let i = startIndex; i < lines.length; i += 1) {
    const cols = splitPasteColumns(lines[i]).map((col) => col.trim())
    const materialId = cols[0] || ''
    if (!materialId) continue
    const quantity = (cols[1] || '').replace(/,/g, '').trim()
    rows.push({ materialId, quantity })
  }

  return rows
}

export type DirectStockResolvedLine = {
  materialId: string
  materialName: string
  targetQuantity: number
  currentQuantity: number
}

export type ResolveDirectStockPasteResult =
  | { ok: true; lines: DirectStockResolvedLine[]; unresolved: string[] }
  | { ok: false; detail: string; unresolved: string[] }

export function resolveDirectStockPasteRows(
  rows: DirectStockPasteRow[],
  materials: Material[],
  onHandByMaterialId: Map<string, number>,
): ResolveDirectStockPasteResult {
  if (!rows.length) {
    return { ok: false, detail: '붙여넣을 내용이 없습니다.', unresolved: [] }
  }

  const unresolved: string[] = []
  const seen = new Set<string>()
  const lines: DirectStockResolvedLine[] = []

  for (const row of rows) {
    const matched = resolveMaterialByInventoryCode(materials, row.materialId)
    if (!matched) {
      unresolved.push(row.materialId)
      continue
    }

    if (seen.has(matched.id)) {
      return {
        ok: false,
        detail: `품목 ${matched.id} 이(가) 중복되었습니다.`,
        unresolved,
      }
    }
    seen.add(matched.id)

    const qty = Number(row.quantity)
    if (!Number.isFinite(qty) || qty < 0) {
      return {
        ok: false,
        detail: `${matched.id} 수량은 0 이상이어야 합니다.`,
        unresolved,
      }
    }

    lines.push({
      materialId: matched.id,
      materialName: matched.materialName,
      targetQuantity: qty,
      currentQuantity: onHandByMaterialId.get(matched.id) ?? 0,
    })
  }

  if (!lines.length) {
    return {
      ok: false,
      detail: unresolved.length
        ? `일치하는 품목이 없습니다. (예: ${unresolved.slice(0, 3).join(', ')})`
        : '붙여넣을 내용이 없습니다.',
      unresolved,
    }
  }

  return { ok: true, lines, unresolved }
}
