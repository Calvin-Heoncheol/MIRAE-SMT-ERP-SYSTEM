import { createBomFormLine, type BomFormLine } from '@/lib/bom/form-state'
import type { Item } from '@/lib/items/types'

export const BOM_PASTE_COLUMNS = [
  { key: 'childProductId', label: '품목코드', required: true },
  { key: 'quantityPer', label: '수량', required: true },
] as const

export function bomPasteSampleValues() {
  return ['MR-001', '2']
}

export function bomPastePlaceholder() {
  const header = BOM_PASTE_COLUMNS.map((column) => column.label).join('\t')
  const sample = bomPasteSampleValues().join('\t')
  const sample2 = ['MR-002', '1'].join('\t')
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
  return BOM_PASTE_COLUMNS.some((column) => column.label === first)
}

export type BomPasteRow = {
  childProductId: string
  quantityPer: string
}

/** Excel 복사본 → 행 파싱 (품목코드 / 수량) */
export function parseBomBulkPaste(text: string): BomPasteRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())

  if (!lines.length) return []

  const startIndex = isHeaderLine(lines[0]) ? 1 : 0
  const rows: BomPasteRow[] = []

  for (let i = startIndex; i < lines.length; i += 1) {
    const cols = splitPasteColumns(lines[i]).map((col) => col.trim())
    const childProductId = cols[0] || ''
    if (!childProductId) continue
    const quantityRaw = cols[1] || '1'
    const quantityPer = quantityRaw.replace(/,/g, '').trim() || '1'
    rows.push({ childProductId, quantityPer })
  }

  return rows
}

function resolveChildItem(token: string, childItems: Item[]): Item | null {
  const needle = token.trim()
  if (!needle) return null

  const byId = childItems.find((item) => item.id.toLowerCase() === needle.toLowerCase())
  if (byId) return byId

  const byMpn = childItems.find(
    (item) => item.mpn.trim() && item.mpn.toLowerCase() === needle.toLowerCase(),
  )
  if (byMpn) return byMpn

  return null
}

export type ResolveBomPasteResult =
  | { ok: true; lines: BomFormLine[]; unresolved: string[] }
  | { ok: false; detail: string; unresolved: string[] }

/** 붙여넣기 행을 구성 품목 목록과 매칭 */
export function resolveBomPasteRows(
  rows: BomPasteRow[],
  childItems: Item[],
): ResolveBomPasteResult {
  if (!rows.length) {
    return { ok: false, detail: '붙여넣을 내용이 없습니다.', unresolved: [] }
  }

  const unresolved: string[] = []
  const seen = new Set<string>()
  const lines: BomFormLine[] = []

  for (const row of rows) {
    const matched = resolveChildItem(row.childProductId, childItems)
    if (!matched) {
      unresolved.push(row.childProductId)
      continue
    }

    if (seen.has(matched.id)) {
      return {
        ok: false,
        detail: `구성 품목 ${matched.id} 이(가) 중복되었습니다.`,
        unresolved,
      }
    }
    seen.add(matched.id)

    const qty = Number(row.quantityPer)
    if (!Number.isFinite(qty) || qty <= 0) {
      return {
        ok: false,
        detail: `${matched.id} 수량은 0보다 큰 숫자여야 합니다.`,
        unresolved,
      }
    }

    lines.push(
      createBomFormLine({
        childProductId: matched.id,
        quantityPer: String(qty),
      }),
    )
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
