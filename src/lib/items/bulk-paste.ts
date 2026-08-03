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

function splitPasteColumns(line: string): string[] {
  if (line.includes('\t')) return line.split('\t')
  if (line.includes(',')) return line.split(',')
  return line.split(/\s{2,}/)
}

function isHeaderLine(line: string, category: ItemCategory) {
  const first = (splitPasteColumns(line)[0] || '').trim()
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
  const value = raw.trim()
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

function splitPasteLines(text: string) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  while (lines.length > 0 && !lines[lines.length - 1].trim()) {
    lines.pop()
  }
  return lines
}

/** Excel 등에서 복사한 행을 품목구분별 열 순서에 맞춰 파싱 */
export function parseItemBulkPaste(text: string, category: ItemCategory): ItemFormState[] {
  const columns = itemBulkColumns(category)
  const lines = splitPasteLines(text)
    .map((line) => line.trim())
    .filter(Boolean)

  const rows: ItemFormState[] = []

  for (const line of lines) {
    if (isHeaderLine(line, category)) continue

    const cols = splitPasteColumns(line).map((col) => col.trim())
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
