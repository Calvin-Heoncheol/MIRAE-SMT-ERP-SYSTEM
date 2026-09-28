import { createBomFormLine, type BomFormLine } from '@/lib/bom/form-state'
import { normalizeBomProcess, type BomProcess } from '@/lib/bom/types'
import {
  formatBomItemCode,
  resolveBomChildByCodeOrMpn,
  resolveBomChildItem,
} from '@/lib/bom/utils'
import type { Item } from '@/lib/items/types'

export const BOM_PASTE_COLUMNS = [
  { key: 'partCode', label: '품목코드', required: false },
  { key: 'name', label: '품목명', required: false },
  { key: 'process', label: '공정', required: false },
  { key: 'spec', label: '규격', required: false },
  { key: 'mpn', label: 'MPN', required: false },
  { key: 'quantityPer', label: 'Qty', required: true },
  { key: 'designators', label: 'Designator', required: false },
] as const

export function bomPasteSampleValues(): string[][] {
  return [
    ['C1608-104K', 'CAP 100nF', 'SMD', '1608 100nF', 'GRM188R71C104KA01D', '2', 'C1,C2'],
    ['', 'RES 10k', 'SMD', '1005 10k', 'RC1005FR-0710KL', '1', 'R1'],
  ]
}

export function bomPastePlaceholder() {
  const header = BOM_PASTE_COLUMNS.map((column) => column.label).join('\t')
  const samples = bomPasteSampleValues().map((row) => row.join('\t'))
  return [header, ...samples].join('\n')
}

function splitPasteColumns(line: string): string[] {
  if (line.includes('\t')) return line.split('\t')
  if (line.includes(',')) return line.split(',')
  return line.split(/\s{2,}/)
}

function stripExcelQuotes(value: string) {
  let next = value.trim()
  if (
    (next.startsWith('"') && next.endsWith('"') && next.length >= 2) ||
    (next.startsWith("'") && next.endsWith("'") && next.length >= 2)
  ) {
    next = next.slice(1, -1).replace(/""/g, '"')
  }
  next = next.replace(/^["'`“”‘’]+/, '').replace(/["'`“”‘’]+$/, '')
  return next.trim()
}

function normalizePasteCell(value: string) {
  return stripExcelQuotes(String(value ?? ''))
}

type ColumnKey =
  | 'partCode'
  | 'name'
  | 'process'
  | 'spec'
  | 'mpn'
  | 'quantityPer'
  | 'designators'

const HEADER_ALIASES: Record<ColumnKey, string[]> = {
  partCode: ['품목코드', '자재코드', 'partcode', 'part no', 'partno', 'item code', 'itemcode', 'code'],
  name: ['품목명', '품명', '자재명', 'description', 'desc', 'name', 'part name'],
  process: ['공정', 'process', 'type', '실장', 'mount', 'smd/dip'],
  spec: ['규격', '사양', 'spec', 'specification', 'value', 'package'],
  mpn: ['mpn', 'manufacturer part', 'mfr part', 'part number', 'partnumber', '제조사부품'],
  quantityPer: ['qty', 'quantity', '수량', '소요량', 'qnty', 'count'],
  designators: ['designator', 'designators', 'ref', 'refdes', 'reference', '위치번호'],
}

function normalizeHeaderToken(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[\s_\-./()]+/g, '')
}

function matchHeaderKey(cell: string): ColumnKey | null {
  const token = normalizeHeaderToken(cell)
  if (!token) return null
  for (const [key, aliases] of Object.entries(HEADER_ALIASES) as [ColumnKey, string[]][]) {
    if (aliases.some((alias) => normalizeHeaderToken(alias) === token)) return key
  }
  return null
}

function detectHeaderMap(cells: string[]): Partial<Record<ColumnKey, number>> | null {
  const map: Partial<Record<ColumnKey, number>> = {}
  let hits = 0
  cells.forEach((cell, index) => {
    const key = matchHeaderKey(cell)
    if (!key || map[key] != null) return
    map[key] = index
    hits += 1
  })
  if (hits < 2) return null
  if (map.partCode == null && map.mpn == null && map.quantityPer == null) return null
  return map
}

function defaultHeaderMap(): Record<ColumnKey, number> {
  return {
    partCode: 0,
    name: 1,
    process: 2,
    spec: 3,
    mpn: 4,
    quantityPer: 5,
    designators: 6,
  }
}

export type BomPasteRow = {
  partCode: string
  name: string
  process: BomProcess
  spec: string
  mpn: string
  quantityPer: string
  designators: string
}

function cellAt(cols: string[], index: number | undefined) {
  if (index == null || index < 0) return ''
  return normalizePasteCell(cols[index] || '')
}

/** 2차원 행(파일/붙여넣기) → BOM 임포트 행 */
export function parseBomImportRows(rawRows: string[][]): BomPasteRow[] {
  const rows = rawRows
    .map((row) => row.map((cell) => normalizePasteCell(cell)))
    .filter((row) => row.some((cell) => cell.length > 0))
  if (!rows.length) return []

  const headerMap = detectHeaderMap(rows[0]) || null
  const startIndex = headerMap ? 1 : 0
  const map = headerMap || defaultHeaderMap()
  const parsed: BomPasteRow[] = []

  for (let i = startIndex; i < rows.length; i += 1) {
    const cols = rows[i]
    const partCode = cellAt(cols, map.partCode)
    const mpn = cellAt(cols, map.mpn)
    const name = cellAt(cols, map.name)
    const spec = cellAt(cols, map.spec)
    const designators = cellAt(cols, map.designators)
    const process = normalizeBomProcess(cellAt(cols, map.process))
    const quantityRaw = cellAt(cols, map.quantityPer) || '1'
    const quantityPer = quantityRaw.replace(/,/g, '').trim() || '1'

    if (!partCode && !mpn && !name && !designators) continue

    parsed.push({
      partCode,
      name,
      process,
      spec,
      mpn,
      quantityPer,
      designators,
    })
  }

  return parsed
}

/** Excel 복사본 → 행 파싱 */
export function parseBomBulkPaste(text: string): BomPasteRow[] {
  const lines = text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())

  if (!lines.length) return []
  return parseBomImportRows(lines.map((line) => splitPasteColumns(line)))
}

export type BomPasteUnresolved = {
  token: string
  quantityPer: string
  partCode: string
  mpn: string
  name: string
  spec: string
  process: BomProcess
  designators: string
}

export type ResolveBomPasteResult =
  | { ok: true; lines: BomFormLine[]; unresolved: BomPasteUnresolved[] }
  | { ok: false; detail: string; unresolved: BomPasteUnresolved[] }

function mergeDesignators(a: string, b: string) {
  const parts = [...a.split(/[,;\s]+/), ...b.split(/[,;\s]+/)]
    .map((part) => part.trim())
    .filter(Boolean)
  return [...new Set(parts)].join(',')
}

function unresolvedToken(row: BomPasteRow) {
  return row.partCode || row.mpn || row.name || '(빈 행)'
}

function pasteRowToFormLine(row: BomPasteRow, matched: Item | null): BomFormLine {
  return createBomFormLine({
    childProductId: matched?.id || '',
    quantityPer: row.quantityPer || '1',
    process: row.process,
    designators: row.designators,
    sourceMpn: row.mpn || matched?.mpn || '',
    sourcePartCode: row.partCode || (matched ? formatBomItemCode(matched) : ''),
    sourceName: row.name || matched?.name || '',
    sourceSpec: row.spec || matched?.specification || '',
  })
}

function matchPasteRow(row: BomPasteRow, childItems: Item[]): Item | null {
  if (!row.partCode.trim() && !row.mpn.trim()) return null
  return (
    resolveBomChildByCodeOrMpn(row.partCode, row.mpn, childItems) ||
    resolveBomChildItem(row.partCode, childItems) ||
    resolveBomChildItem(row.mpn, childItems)
  )
}

function toUnresolved(row: BomPasteRow): BomPasteUnresolved {
  return {
    token: unresolvedToken(row),
    quantityPer: row.quantityPer || '1',
    partCode: row.partCode,
    mpn: row.mpn,
    name: row.name,
    spec: row.spec,
    process: row.process,
    designators: row.designators,
  }
}

/** 붙여넣기/파일 행을 구성 품목과 매칭 (품목코드 또는 MPN). 미매칭도 표 행으로 유지 */
export function resolveBomPasteRows(
  rows: BomPasteRow[],
  childItems: Item[],
): ResolveBomPasteResult {
  if (!rows.length) {
    return { ok: false, detail: '붙여넣을 내용이 없습니다.', unresolved: [] }
  }

  const unresolved: BomPasteUnresolved[] = []
  const mergedMatched = new Map<string, BomFormLine>()
  const unmatchedLines: BomFormLine[] = []

  for (const row of rows) {
    const qty = Number(row.quantityPer)
    if (row.quantityPer.trim() && (!Number.isFinite(qty) || qty <= 0)) {
      const label = row.partCode || row.mpn || row.name || '행'
      return {
        ok: false,
        detail: `${label} 수량은 0보다 큰 숫자여야 합니다.`,
        unresolved,
      }
    }

    const matched = matchPasteRow(row, childItems)
    if (!matched) {
      unresolved.push(toUnresolved(row))
      unmatchedLines.push(pasteRowToFormLine(row, null))
      continue
    }

    const existing = mergedMatched.get(matched.id)
    if (existing) {
      existing.quantityPer = String(Number(existing.quantityPer) + (Number.isFinite(qty) ? qty : 1))
      existing.designators = mergeDesignators(existing.designators, row.designators)
      if (!existing.process && row.process) existing.process = row.process
      if (!existing.sourceName && row.name) existing.sourceName = row.name
      if (!existing.sourceSpec && row.spec) existing.sourceSpec = row.spec
      continue
    }

    mergedMatched.set(matched.id, pasteRowToFormLine(row, matched))
  }

  const lines = [...mergedMatched.values(), ...unmatchedLines]
  if (!lines.length) {
    return { ok: false, detail: '붙여넣을 내용이 없습니다.', unresolved: [] }
  }

  return { ok: true, lines, unresolved }
}

export type BomSpreadsheetColumnKey =
  | 'sourcePartCode'
  | 'sourceName'
  | 'process'
  | 'sourceSpec'
  | 'sourceMpn'
  | 'quantityPer'
  | 'designators'

export const BOM_SPREADSHEET_COLUMNS: Array<{
  key: BomSpreadsheetColumnKey
  label: string
  widthClass: string
  mono?: boolean
  align?: 'left' | 'right' | 'center'
}> = [
  { key: 'sourcePartCode', label: '품목코드', widthClass: 'min-w-[9rem]', mono: true },
  { key: 'sourceName', label: '품목명', widthClass: 'min-w-[10rem]' },
  { key: 'process', label: '공정', widthClass: 'w-28', align: 'center' },
  { key: 'sourceSpec', label: '규격', widthClass: 'min-w-[9rem]' },
  { key: 'sourceMpn', label: 'MPN', widthClass: 'min-w-[10rem]', mono: true },
  { key: 'quantityPer', label: 'Qty', widthClass: 'w-24', align: 'right' },
  { key: 'designators', label: 'Designator', widthClass: 'min-w-[9rem]', mono: true },
]

/** 한 열에 세로 붙여넣기 — 행이 부족하면 추가 */
export function applyBomColumnPaste(input: {
  lines: BomFormLine[]
  startRowIndex: number
  columnKey: BomSpreadsheetColumnKey
  text: string
  childItems: Item[]
}): BomFormLine[] | null {
  const values = input.text
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => normalizePasteCell(line))
  if (!values.length || (values.length === 1 && !values[0])) return null

  const next = [...input.lines]
  while (next.length < input.startRowIndex + values.length) {
    next.push(createBomFormLine({ quantityPer: '' }))
  }

  values.forEach((value, offset) => {
    const index = input.startRowIndex + offset
    const line = next[index]
    if (!line) return

    let patched: BomFormLine = { ...line }
    if (input.columnKey === 'process') {
      patched.process = normalizeBomProcess(value)
    } else if (input.columnKey === 'quantityPer') {
      patched.quantityPer = value.replace(/,/g, '').trim() || ''
    } else {
      patched = { ...patched, [input.columnKey]: value }
    }

    if (input.columnKey === 'sourcePartCode' || input.columnKey === 'sourceMpn') {
      patched = rematchBomFormLine(patched, input.childItems)
    }
    next[index] = patched
  })

  return next
}

export function rematchBomFormLine(line: BomFormLine, childItems: Item[]): BomFormLine {
  const matched =
    resolveBomChildByCodeOrMpn(line.sourcePartCode, line.sourceMpn, childItems) ||
    (line.sourcePartCode.trim()
      ? resolveBomChildItem(line.sourcePartCode, childItems)
      : null) ||
    (line.sourceMpn.trim() ? resolveBomChildItem(line.sourceMpn, childItems) : null)

  if (!matched) {
    return { ...line, childProductId: '' }
  }

  return {
    ...line,
    childProductId: matched.id,
    sourcePartCode: line.sourcePartCode.trim() || formatBomItemCode(matched),
    sourceName: line.sourceName.trim() || matched.name,
    sourceMpn: line.sourceMpn.trim() || matched.mpn,
    sourceSpec: line.sourceSpec.trim() || matched.specification,
  }
}

export function enrichBomFormLinesFromItems(
  lines: BomFormLine[],
  childItems: Item[],
): BomFormLine[] {
  return lines.map((line) => {
    if (!line.childProductId.trim()) return line
    const child = childItems.find((item) => item.id === line.childProductId)
    if (!child) return line
    return {
      ...line,
      sourcePartCode: line.sourcePartCode.trim() || formatBomItemCode(child),
      sourceName: line.sourceName.trim() || child.name,
      sourceMpn: line.sourceMpn.trim() || child.mpn,
      sourceSpec: line.sourceSpec.trim() || child.specification,
    }
  })
}

export function unresolvedFromBomLines(lines: BomFormLine[]): BomPasteUnresolved[] {
  return lines
    .filter(
      (line) =>
        !line.childProductId.trim() &&
        (line.sourcePartCode.trim() ||
          line.sourceMpn.trim() ||
          line.sourceName.trim() ||
          line.designators.trim()),
    )
    .map((line) => ({
      token: line.sourcePartCode || line.sourceMpn || line.sourceName || '(빈 행)',
      quantityPer: line.quantityPer || '1',
      partCode: line.sourcePartCode,
      mpn: line.sourceMpn,
      name: line.sourceName,
      spec: line.sourceSpec,
      process: line.process,
      designators: line.designators,
    }))
}
