import { emptyItemForm, type ItemFormState } from './form-state'
import {
  isManualItemCodeCategory,
  isRawMaterialItemCategory,
  ITEM_PCB_SIDE_MODE_LABELS,
  ITEM_PROCESS_TYPE_LABELS,
  type ItemCategory,
  type ItemMaterialType,
  type ItemPcbSideMode,
  type ItemProcessType,
  type ItemSupplyType,
} from './types'

export type ItemBulkColumn = {
  key: keyof ItemFormState
  label: string
  required?: boolean
}

const RAW_MATERIAL_BULK_COLUMNS: ItemBulkColumn[] = [
  { key: 'customerName', label: '고객사', required: true },
  { key: 'id', label: '품목코드', required: true },
  { key: 'materialType', label: '공정', required: true },
  { key: 'name', label: '품목명', required: true },
  { key: 'specification', label: '사양 규격' },
  { key: 'package', label: '패키지' },
  { key: 'mpn', label: 'MPN' },
  { key: 'supplyType', label: '도급/사급' },
]

const SUB_MATERIAL_BULK_COLUMNS: ItemBulkColumn[] = [
  { key: 'customerName', label: '고객사', required: true },
  { key: 'id', label: '품목코드' },
  { key: 'name', label: '품목명', required: true },
  { key: 'specification', label: '사양' },
  { key: 'package', label: '패키지' },
  { key: 'mpn', label: 'MPN' },
  { key: 'supplyType', label: '도급/사급' },
]

const PRODUCT_BULK_COLUMNS: ItemBulkColumn[] = [
  { key: 'customerName', label: '고객사', required: true },
  { key: 'id', label: '품목코드', required: true },
  { key: 'name', label: '품목명', required: true },
  { key: 'version', label: '버전' },
]

const SEMI_FINISHED_BULK_COLUMNS: ItemBulkColumn[] = [
  ...PRODUCT_BULK_COLUMNS,
  { key: 'processType', label: '생산 공정', required: true },
  { key: 'pcbSideMode', label: '면', required: true },
]

export function itemBulkColumns(category: ItemCategory): ItemBulkColumn[] {
  if (isRawMaterialItemCategory(category)) {
    return RAW_MATERIAL_BULK_COLUMNS
  }
  if (category === 2) {
    return SUB_MATERIAL_BULK_COLUMNS.map((column) =>
      column.key === 'id'
        ? { ...column, required: isManualItemCodeCategory(category) }
        : column,
    )
  }
  if (category === 3) {
    return SEMI_FINISHED_BULK_COLUMNS
  }
  return PRODUCT_BULK_COLUMNS.map((column) =>
    column.key === 'id'
      ? { ...column, required: isManualItemCodeCategory(category) }
      : column,
  )
}

export function itemBulkPasteSampleValues(category: ItemCategory): string[] {
  if (category === 2) {
    return ['미래전자', '', '나사 M3', 'SUS', '', '', '도급']
  }
  if (category === 3) {
    return ['미래전자', 'SFG-CUSTOM', '메인보드', 'A1', 'SMD', '단면']
  }
  if (category === 4) {
    return ['미래전자', 'FG-CUSTOM', '조립제품 A', 'V1']
  }
  return ['미래전자', 'ABC-100', 'SMD', '저항 10K', '1/10W', '0603', 'RC0603FR', '도급']
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

function realignOverSplitColumns(
  cols: string[],
  delimiter: PasteDelimiter,
  expectedCols: number,
): string[] {
  if (cols.length <= expectedCols) return cols
  if (delimiter !== 'multispace' && delimiter !== 'comma') return cols

  const head = cols.slice(0, expectedCols - 1)
  const tail = cols.slice(expectedCols - 1).filter(Boolean).join(' ')
  return [...head, tail]
}

function splitPasteColumns(
  line: string,
  delimiter: PasteDelimiter,
  expectedCols: number,
): string[] {
  const cols = splitByDelimiter(line, delimiter).map(normalizePasteCell)
  return realignOverSplitColumns(cols, delimiter, expectedCols)
}

function isHeaderColumns(cols: string[], category: ItemCategory) {
  const first = normalizePasteCell(cols[0] || '')
  if (!first) return false
  if (/^(고객사(명)?|품목(코드|명)|공정(\s*구분)?|생산\s*공정|버전|면|도급\/사급|MPN)$/i.test(first)) return true
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

function normalizePasteProcessType(value: string): ItemProcessType {
  const raw = value.trim().toLowerCase().replace(/\s+/g, '')
  if (raw === 'smt' || raw === 'smd') return 'smt'
  if (raw === 'post' || raw === 'dip' || raw === '후공정') return 'post'
  if (
    raw === 'smt_post' ||
    raw === 'smd_post' ||
    raw === 'smt+post' ||
    raw === 'smd+post' ||
    raw === 'smd+dip' ||
    raw === 'smt+dip' ||
    raw === 'smd+후공정' ||
    raw === 'smt+후공정'
  ) {
    return 'smt_post'
  }
  const label = value.trim()
  if (label === ITEM_PROCESS_TYPE_LABELS.smt) return 'smt'
  if (label === ITEM_PROCESS_TYPE_LABELS.post) return 'post'
  if (label === ITEM_PROCESS_TYPE_LABELS.smt_post) return 'smt_post'
  return ''
}

function normalizePastePcbSideMode(value: string): ItemPcbSideMode {
  const raw = value.trim().toLowerCase().replace(/\s+/g, '')
  if (raw === 'single' || raw === '단면') return 'single'
  if (raw === 'duo' || raw === '더블' || raw === '듀얼') return 'duo'
  if (raw === 'double' || raw === 'dual' || raw === '양면') return 'double'
  if (value.trim() === ITEM_PCB_SIDE_MODE_LABELS.single) return 'single'
  if (value.trim() === ITEM_PCB_SIDE_MODE_LABELS.duo) return 'duo'
  if (value.trim() === ITEM_PCB_SIDE_MODE_LABELS.double) return 'double'
  return ''
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
    case 'processType':
      return { ...form, processType: normalizePasteProcessType(value) }
    case 'pcbSideMode':
      return { ...form, pcbSideMode: normalizePastePcbSideMode(value) }
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
        : lines.map((line) => splitPasteColumns(line, delimiter, expectedCols))
  const records = mergeContinuationRecords(rawRecords, expectedCols, category)

  const rows: ItemFormState[] = []

  for (const rawCols of records) {
    if (isHeaderColumns(rawCols, category)) continue

    const cols =
      delimiter === 'tab' || delimiter === 'comma'
        ? realignOverSplitColumns(rawCols.map(normalizePasteCell), delimiter, expectedCols)
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
  return (
    !row.customerName.trim() &&
    !row.id.trim() &&
    !row.name.trim() &&
    !row.materialType &&
    !row.package.trim() &&
    !row.specification.trim() &&
    !row.mpn.trim() &&
    !row.supplyType
  )
}
