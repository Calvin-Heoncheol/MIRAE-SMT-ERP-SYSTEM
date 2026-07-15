import { emptyItemForm, type ItemFormState } from './form-state'
import {
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
    { key: 'pcbSideMode', label: '단면/양면', required: true },
    { key: 'processType', label: '공정', required: true },
    { key: 'unitPrice', label: '단가' },
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
    3: ['SFG-CUSTOM', '메인보드', '단면', 'SMD', '1500'],
    4: ['FG-CUSTOM', '완제품 A'],
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
    form.processType = 'smt'
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
  if (trimmed === 'dual' || trimmed === '양면') return 'dual'
  if (trimmed === 'single' || trimmed === '단면') return 'single'
  return ''
}

function normalizePasteProcessType(value: string): ItemProcessType {
  const trimmed = value.trim().toLowerCase().replace(/\s+/g, '')
  if (trimmed === 'smt' || trimmed === 'smd') return 'smt'
  if (trimmed === 'post' || trimmed === 'dip' || trimmed === '후공정') return 'post'
  if (
    trimmed === 'smt_post' ||
    trimmed === 'smd_post' ||
    trimmed === 'smt+post' ||
    trimmed === 'smd+dip' ||
    trimmed === 'smt+dip' ||
    trimmed === 'smd+후공정' ||
    trimmed === 'smt+후공정' ||
    trimmed === 'smd+post'
  ) {
    return 'smt_post'
  }
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
    case 'processType':
      return { ...form, processType: normalizePasteProcessType(value) }
    case 'unitPrice':
      return { ...form, unitPrice: normalizePasteUnitPrice(value) }
    case 'itemCategory':
      return form
    default:
      return { ...form, [key]: value }
  }
}

/** Excel 등에서 복사한 행을 품목구분별 열 순서에 맞춰 파싱 */
export function parseItemBulkPaste(text: string, category: ItemCategory): ItemFormState[] {
  const columns = itemBulkColumns(category)
  const lines = text
    .trim()
    .split(/\r?\n/)
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

export function isEmptyItemBulkRow(row: ItemFormState) {
  return !row.id.trim() && !row.name.trim() && !row.specification.trim() && !row.mpn.trim()
}
