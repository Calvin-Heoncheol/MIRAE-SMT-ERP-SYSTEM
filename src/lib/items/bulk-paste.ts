import { emptyItemForm, type ItemFormState } from './form-state'
import {
  type ItemCategory,
  type ItemMaterialType,
  type ItemPcbSideMode,
  type ItemSupplyType,
} from './types'

export type ItemBulkColumn = {
  key: keyof ItemFormState
  label: string
  required?: boolean
}

const BULK_COLUMNS: Record<ItemCategory, ItemBulkColumn[]> = {
  1: [
    { key: 'id', label: '품목코드', required: true },
    { key: 'name', label: '품목명', required: true },
    { key: 'specification', label: '규격' },
    { key: 'mpn', label: 'MPN' },
    { key: 'materialType', label: '구분', required: true },
    { key: 'supplyType', label: '도급/사급', required: true },
    { key: 'supplier', label: '공급사' },
    { key: 'unitPrice', label: '단가' },
  ],
  2: [
    { key: 'name', label: '품목명', required: true },
    { key: 'specification', label: '규격' },
    { key: 'supplier', label: '공급사' },
    { key: 'unitPrice', label: '단가' },
  ],
  3: [
    { key: 'id', label: '품목코드' },
    { key: 'name', label: '품목명', required: true },
    { key: 'pcbSideMode', label: '면 구분', required: true },
    { key: 'smdUnitPrice', label: 'SMD 단가' },
    { key: 'dipUnitPrice', label: 'DIP 단가' },
    { key: 'materialUnitPrice', label: '자재 단가' },
  ],
  4: [
    { key: 'id', label: '품목코드' },
    { key: 'name', label: '품목명', required: true },
  ],
}

export function itemBulkColumns(category: ItemCategory): ItemBulkColumn[] {
  return BULK_COLUMNS[category]
}

export function itemBulkPasteSampleValues(category: ItemCategory): string[] {
  const sampleByCategory: Record<ItemCategory, string[]> = {
    1: ['MR-001', '저항 10K', '0603', 'RC0603', 'SMD', '도급', '서창전자', '12'],
    2: ['나사 M3', 'SUS', '서창전자', '50'],
    3: ['SFG-CUSTOM', '메인보드', '단면', '1000', '500', '300'],
    4: ['FG-CUSTOM', '조립제품 A'],
  }
  return sampleByCategory[category]
}

export function itemBulkPastePlaceholder(category: ItemCategory) {
  const columns = itemBulkColumns(category)
  const header = columns.map((column) => column.label).join('\t')
  const sample = itemBulkPasteSampleValues(category).join('\t')
  return `${header}\n${sample}`
}

export function defaultItemBulkRow(category: ItemCategory): ItemFormState {
  const form = emptyItemForm()
  form.itemCategory = category
  if (category === 3) {
    form.pcbSideMode = 'single'
  }
  return form
}

function normalizePasteRawText(text: string) {
  return text
    .replace(/\uFEFF/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/\u3000/g, ' ')
}

function normalizePasteCell(value: string) {
  return normalizePasteRawText(value)
    .replace(/\r?\n/g, ' ')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

/**
 * 엑셀 등 CSV/TSV 붙여넣기 — 따옴표로 감싼 필드 안의 줄바꿈·구분자는 행/열로 쪼개지 않음.
 * fieldDelimiter 가 null 이면 논리 행만 분리(행당 필드 1개).
 */
function parseQuotedRecords(text: string, fieldDelimiter: string | null): string[][] {
  const input = normalizePasteRawText(text).replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  const rows: string[][] = []
  let row: string[] = []
  let field = ''
  let inQuotes = false
  let i = 0

  const flushField = () => {
    row.push(field)
    field = ''
  }

  const flushRow = () => {
    flushField()
    if (row.some((cell) => cell.trim())) {
      rows.push(row)
    }
    row = []
  }

  while (i < input.length) {
    const char = input[i]!

    if (inQuotes) {
      if (char === '"') {
        if (input[i + 1] === '"') {
          field += '"'
          i += 2
          continue
        }
        inQuotes = false
        i += 1
        continue
      }
      field += char
      i += 1
      continue
    }

    if (char === '"' && field.length === 0) {
      inQuotes = true
      i += 1
      continue
    }

    if (fieldDelimiter && char === fieldDelimiter) {
      flushField()
      i += 1
      continue
    }

    if (char === '\n') {
      flushRow()
      i += 1
      continue
    }

    field += char
    i += 1
  }

  if (field.length > 0 || row.length > 0) {
    flushField()
    if (row.some((cell) => cell.trim())) {
      rows.push(row)
    }
  }

  return rows
}

function splitPasteLines(text: string) {
  return parseQuotedRecords(text, null).map((row) => row[0] ?? '')
}

type PasteDelimiter = 'tab' | 'comma' | 'multispace' | 'none'

function splitByDelimiter(line: string, delimiter: PasteDelimiter): string[] {
  if (delimiter === 'tab') {
    return parseQuotedRecords(line, '\t')[0] ?? []
  }
  if (delimiter === 'comma') {
    const cols = parseQuotedRecords(line, ',')[0] ?? []
    if (cols.length) return cols
    return line.split(/[,，]/)
  }
  if (delimiter === 'multispace') return line.split(/\s{2,}/)
  return [line]
}

function scoreDelimiter(lines: string[], delimiter: PasteDelimiter, expectedCols: number) {
  if (!lines.length) return Number.POSITIVE_INFINITY
  let total = 0
  for (const line of lines) {
    const count = splitByDelimiter(line, delimiter).length
    // 열 수가 기대보다 많이 쪼개지면(이름 안 공백 등) 강하게 감점
    const over = Math.max(0, count - expectedCols)
    const under = Math.max(0, expectedCols - count)
    total += under + over * 3
  }
  return total / lines.length
}

/**
 * 붙여넣기 전체에서 구분자 1회 결정.
 * - 탭이 있으면 무조건 탭(엑셀 기본)
 * - 없으면 쉼표 / 연속공백 중 기대 열 수에 더 가까운 쪽
 * - 둘 다 크게 어긋나면 분할하지 않음(한 칸에 넣고 수동 수정 유도)
 */
function detectPasteDelimiter(lines: string[], expectedCols: number): PasteDelimiter {
  const dataLines = lines.map((line) => line.trim()).filter(Boolean)
  if (!dataLines.length) return 'none'
  if (dataLines.some((line) => line.includes('\t'))) return 'tab'

  const commaScore = scoreDelimiter(dataLines, 'comma', expectedCols)
  const spaceScore = scoreDelimiter(dataLines, 'multispace', expectedCols)
  const noneScore = scoreDelimiter(dataLines, 'none', expectedCols)

  const best = Math.min(commaScore, spaceScore, noneScore)
  if (best === noneScore) return 'none'
  if (commaScore <= spaceScore) return 'comma'
  return 'multispace'
}

function packFields(parts: string[], fieldCount: number): string[] {
  if (fieldCount <= 0) return []
  if (fieldCount === 1) return [parts.filter(Boolean).join(' ')]
  if (parts.length <= fieldCount) {
    return [...parts, ...Array.from({ length: fieldCount - parts.length }, () => '')]
  }
  if (fieldCount === 2) {
    return [parts[0] || '', parts.slice(1).filter(Boolean).join(' ')]
  }
  const head = parts[0] || ''
  const tailCount = fieldCount - 2
  const tail = parts.slice(-tailCount)
  const middle = parts.slice(1, parts.length - tailCount).filter(Boolean).join(' ')
  return [head, middle, ...tail]
}

/** 원자재: SMD/DIP·도급/사급 앵커로 열 밀림 복구 */
function realignRawMaterialColumns(cols: string[]): string[] | null {
  let supplyIdx = -1
  for (let index = cols.length - 1; index >= 0; index -= 1) {
    if (cols[index] === '도급' || cols[index] === '사급') {
      supplyIdx = index
      break
    }
  }
  if (supplyIdx < 1) return null

  let materialIdx = -1
  for (let index = supplyIdx - 1; index >= 0; index -= 1) {
    const upper = cols[index].toUpperCase()
    if (upper === 'SMD' || upper === 'DIP') {
      materialIdx = index
      break
    }
  }
  if (materialIdx < 1) return null

  const left = cols.slice(0, materialIdx)
  const right = cols.slice(supplyIdx + 1)
  const [id, name, specification, mpn] = packFields(left, 4)
  const [supplier, unitPrice] = packFields(right, 2)

  return [
    id,
    name,
    specification,
    mpn,
    cols[materialIdx],
    cols[supplyIdx],
    supplier,
    unitPrice,
  ]
}

/** 반제품: 면구분 앵커로 열 밀림 복구 */
function realignSemiFinishedColumns(cols: string[]): string[] | null {
  let sideIdx = -1
  for (let index = 0; index < cols.length; index += 1) {
    const mode = normalizePastePcbSideMode(cols[index])
    if (mode) {
      sideIdx = index
      break
    }
  }
  if (sideIdx < 1) return null

  const left = cols.slice(0, sideIdx)
  const right = cols.slice(sideIdx + 1)
  const [id, name] = packFields(left, 2)
  const prices = packFields(right, 3)
  return [id, name, cols[sideIdx], prices[0], prices[1], prices[2]]
}

function realignOverSplitColumns(
  cols: string[],
  delimiter: PasteDelimiter,
  expectedCols: number,
  category: ItemCategory,
): string[] {
  if (cols.length <= expectedCols) return cols
  if (delimiter !== 'multispace' && delimiter !== 'comma') return cols

  if (category === 1) {
    const aligned = realignRawMaterialColumns(cols)
    if (aligned) return aligned
  }
  if (category === 3) {
    const aligned = realignSemiFinishedColumns(cols)
    if (aligned) return aligned
  }

  const head = cols.slice(0, expectedCols - 1)
  const tail = cols.slice(expectedCols - 1).filter(Boolean).join(' ')
  return [...head, tail]
}

function splitPasteColumns(
  line: string,
  delimiter: PasteDelimiter,
  expectedCols: number,
  category: ItemCategory,
): string[] {
  const cols = splitByDelimiter(line, delimiter).map(normalizePasteCell)
  return realignOverSplitColumns(cols, delimiter, expectedCols, category)
}

function isHeaderColumns(cols: string[], category: ItemCategory) {
  const first = normalizePasteCell(cols[0] || '')
  if (!first) return false
  if (/^품목(코드|명)$/i.test(first)) return true
  return itemBulkColumns(category).some((column) => column.label === first)
}

function normalizePasteMaterialType(value: string): ItemMaterialType {
  const upper = value.trim().toUpperCase()
  if (upper === 'SMD' || upper === 'DIP') return upper
  return ''
}

function normalizePasteSupplyType(value: string): ItemSupplyType {
  const trimmed = value.trim()
  if (trimmed === '도급' || trimmed === '사급') return trimmed
  return ''
}

function normalizePastePcbSideMode(value: string): ItemPcbSideMode {
  const trimmed = value.trim().toLowerCase()
  if (trimmed === 'double' || trimmed === 'dual' || trimmed === '양면') return 'double'
  if (trimmed === 'duo' || trimmed === '듀얼') return 'duo'
  if (trimmed === 'single' || trimmed === '단면') return 'single'
  return ''
}

function normalizePasteUnitPrice(value: string) {
  return value.trim().replace(/[^\d.]/g, '')
}

function applyPasteValue(
  form: ItemFormState,
  key: keyof ItemFormState,
  raw: string,
): ItemFormState {
  const value = normalizePasteCell(raw)
  switch (key) {
    case 'materialType':
      return { ...form, materialType: normalizePasteMaterialType(value) }
    case 'supplyType':
      return { ...form, supplyType: normalizePasteSupplyType(value) }
    case 'pcbSideMode':
      return { ...form, pcbSideMode: normalizePastePcbSideMode(value) }
    case 'unitPrice':
      return { ...form, unitPrice: normalizePasteUnitPrice(value) }
    case 'smdUnitPrice':
      return { ...form, smdUnitPrice: normalizePasteUnitPrice(value) }
    case 'dipUnitPrice':
      return { ...form, dipUnitPrice: normalizePasteUnitPrice(value) }
    case 'materialUnitPrice':
      return { ...form, materialUnitPrice: normalizePasteUnitPrice(value) }
    case 'itemCategory':
      return form
    default:
      return { ...form, [key]: value }
  }
}

function looksLikeNewItemRow(firstCell: string, category: ItemCategory) {
  const value = firstCell.trim()
  if (!value) return false
  // 규격 이어쓰기(대치품 등)는 보통 공백·한글이 있음
  if (/\s/.test(value) || /[가-힣]/.test(value)) return false
  if (category === 2) return false
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,}$/.test(value)
}

/** 따옴표 없이 줄바꿈된 규격 셀 등으로 쪼개진 행을 다시 합침 */
function mergeContinuationRecords(
  records: string[][],
  expectedCols: number,
  category: ItemCategory,
): string[][] {
  const out: string[][] = []
  for (const cols of records) {
    if (!out.length) {
      out.push([...cols])
      continue
    }

    const prev = out[out.length - 1]!
    const first = cols[0] || ''
    const shouldMerge =
      prev.length > 0 &&
      prev.length < expectedCols &&
      cols.length < expectedCols &&
      !looksLikeNewItemRow(first, category)

    if (!shouldMerge) {
      out.push([...cols])
      continue
    }

    const merged = [...prev]
    merged[merged.length - 1] = `${merged[merged.length - 1] || ''} ${first}`.trim()
    merged.push(...cols.slice(1))
    out[out.length - 1] = merged
  }
  return out
}

/** Excel 등에서 복사한 행을 품목구분별 열 순서에 맞춰 파싱 */
export function parseItemBulkPaste(text: string, category: ItemCategory): ItemFormState[] {
  const columns = itemBulkColumns(category)
  const expectedCols = columns.length
  const lines = splitPasteLines(text)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim())
  const delimiter = detectPasteDelimiter(lines, expectedCols)

  // 엑셀은 탭+따옴표가 기본 — 전체 텍스트를 한 번에 파싱해야 규격 셀 줄바꿈이 깨지지 않음
  const rawRecords =
    delimiter === 'tab'
      ? parseQuotedRecords(text, '\t')
      : delimiter === 'comma'
        ? parseQuotedRecords(text, ',')
        : lines.map((line) => splitPasteColumns(line, delimiter, expectedCols, category))
  const records = mergeContinuationRecords(rawRecords, expectedCols, category)

  const rows: ItemFormState[] = []

  for (const rawCols of records) {
    if (isHeaderColumns(rawCols, category)) continue

    const cols =
      delimiter === 'tab' || delimiter === 'comma'
        ? realignOverSplitColumns(
            rawCols.map(normalizePasteCell),
            delimiter,
            expectedCols,
            category,
          )
        : rawCols
    if (!cols.some(Boolean)) continue

    let form = defaultItemBulkRow(category)
    columns.forEach((column, index) => {
      form = applyPasteValue(form, column.key, cols[index] || '')
    })

    rows.push(form)
  }

  return rows.length ? rows : [defaultItemBulkRow(category)]
}

/**
 * 등록 품목 테이블에서 특정 열에 세로 붙여넣기.
 * - 탭이 있으면(여러 열) null → 전체 일괄 파싱으로 처리
 * - 한 줄만이면 null → 브라우저 기본 붙여넣기
 * - 여러 줄·단일 열이면 해당 컬럼에 위에서 아래로 채움 (행 부족 시 추가)
 */
export function applyItemBulkColumnPaste(input: {
  rows: ItemFormState[]
  category: ItemCategory
  startRowIndex: number
  columnKey: keyof ItemFormState
  text: string
}): ItemFormState[] | null {
  const lines = splitPasteLines(input.text)
  if (lines.length <= 1) return null
  if (lines.some((line) => line.includes('\t'))) return null

  const next = input.rows.map((row) => ({ ...row }))
  while (next.length < input.startRowIndex + lines.length) {
    next.push(defaultItemBulkRow(input.category))
  }

  lines.forEach((line, offset) => {
    const index = input.startRowIndex + offset
    next[index] = applyPasteValue(next[index], input.columnKey, line)
  })

  return next
}

export function isEmptyItemBulkRow(row: ItemFormState) {
  return !row.id.trim() && !row.name.trim() && !row.specification.trim() && !row.mpn.trim()
}
