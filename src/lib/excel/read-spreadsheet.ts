'use client'

import { scoreBomHeader } from '@/lib/quotes/bom-columns'
import { scorePickPlaceHeader, scoreSpreadsheetHeader } from '@/lib/quotes/spreadsheet-header-score'
import {
  detectStrikethroughRowsFromHtml,
  detectStrikethroughRowsFromXlsxBuffer,
  mapRawSheetStrikeRowsToFilteredRows,
} from '@/lib/excel/bom-strikethrough'

export type SpreadsheetReadKind = 'auto' | 'pickplace' | 'bom'

export type BomSpreadsheetReadResult = {
  rows: string[][]
  struckRows: Set<number>
}

type WorkBook = import('xlsx').WorkBook

function cellToString(value: unknown) {
  if (value == null) return ''
  return String(value).trim()
}

function parseDelimitedLine(line: string): string[] {
  const delimiter = line.includes('\t') && !line.includes(',') ? '\t' : ','
  if (delimiter === '\t') {
    return line.split('\t').map((cell) => cell.trim())
  }
  return parseCsvLine(line)
}

function scoreRows(rows: string[][], kind: SpreadsheetReadKind) {
  if (kind === 'bom') return scoreBomHeader(rows)
  if (kind === 'pickplace') return scorePickPlaceHeader(rows)
  return scoreSpreadsheetHeader(rows)
}

function rowsFromText(text: string): string[][] {
  return text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map((line) => parseDelimitedLine(line))
}

function decodeBufferAsText(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) {
    return new TextDecoder('utf-16le').decode(buffer)
  }
  if (bytes.length >= 2 && bytes[0] === 0xfe && bytes[1] === 0xff) {
    return new TextDecoder('utf-16be').decode(buffer)
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(buffer)
}

function isZipExcel(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer.slice(0, 4))
  return bytes[0] === 0x50 && bytes[1] === 0x4b
}

function isOleExcel(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer.slice(0, 8))
  return bytes[0] === 0xd0 && bytes[1] === 0xcf
}

function isHtmlOrXmlSpreadsheet(text: string) {
  const head = text.trimStart().slice(0, 500).toLowerCase()
  return (
    head.startsWith('<html') ||
    head.startsWith('<?xml') ||
    head.startsWith('<!doctype html') ||
    head.includes('<table') ||
    head.includes('urn:schemas-microsoft-com:office:spreadsheet')
  )
}

function isEncryptedExcelBuffer(buffer: ArrayBuffer, text: string) {
  const head = text.slice(0, 8000)
  return /EncryptedPackage|EncryptionInfo|StrongEncryptionDataSpace/i.test(head)
}

function rowsLookLikeBinaryGarbage(rows: string[][]) {
  const sample = rows
    .slice(0, 8)
    .flat()
    .join(' ')
    .slice(0, 4000)
  if (!sample.trim()) return true
  if (/EncryptedPackage|EncryptionInfo|Root Entry/i.test(sample)) return true
  const replacementChars = (sample.match(/\uFFFD/g) || []).length
  if (replacementChars >= 8) return true
  const nonPrintable = (sample.match(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g) || []).length
  return nonPrintable >= 12
}

function buildUnreadableSpreadsheetError(detail?: string) {
  return new Error(
    detail ??
      '암호화되었거나 읽을 수 없는 엑셀 파일입니다. Excel에서 암호를 해제한 뒤 "다른 이름으로 저장 → CSV(.csv) 또는 Excel 통합 문서(.xlsx)"로 저장해 다시 업로드해 주세요.',
  )
}

function arrayBufferToBinaryString(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer)
  let out = ''
  const chunk = 0x8000
  for (let i = 0; i < bytes.length; i += chunk) {
    out += String.fromCharCode(...bytes.subarray(i, i + chunk))
  }
  return out
}

function assertReadableSpreadsheetRows(rows: string[][], kind: SpreadsheetReadKind) {
  if (rowsLookLikeBinaryGarbage(rows)) {
    throw buildUnreadableSpreadsheetError()
  }
  if (kind !== 'auto' && scoreRows(rows, kind) <= 0) {
    throw new Error(
      '스프레드시트 내용을 인식하지 못했습니다. CSV로 저장했거나 암호가 해제된 xlsx 파일인지 확인해 주세요.',
    )
  }
}

async function loadXlsx() {
  const mod = await import('xlsx')
  return (mod as unknown as { default?: typeof mod }).default ?? mod
}

async function workbookToBestRows(workbook: WorkBook, kind: SpreadsheetReadKind) {
  const result = await workbookToBestSheet(workbook, kind)
  return result.rows
}

async function workbookToBestSheet(workbook: WorkBook, kind: SpreadsheetReadKind) {
  const XLSX = await loadXlsx()
  let bestRows: string[][] = []
  let bestScore = -1
  let bestSheetIndex = 0
  let bestRawRows: unknown[][] = []

  for (const [sheetIndex, sheetName] of workbook.SheetNames.entries()) {
    const sheet = workbook.Sheets[sheetName]
    if (!sheet) continue

    const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false }) as unknown[][]
    const rows = raw.map((row) => row.map(cellToString)).filter((row) => row.some(Boolean))
    if (!rows.length) continue

    const score = scoreRows(rows, kind)
    if (score > bestScore || (score === bestScore && rows.length > bestRows.length)) {
      bestScore = score
      bestRows = rows
      bestSheetIndex = sheetIndex
      bestRawRows = raw
    }
  }

  if (!bestRows.length) {
    throw new Error('엑셀 시트에 읽을 수 있는 데이터가 없습니다.')
  }

  assertReadableSpreadsheetRows(bestRows, kind)
  return { rows: bestRows, sheetIndex: bestSheetIndex, rawRows: bestRawRows }
}

async function readWorkbookFromBuffer(buffer: ArrayBuffer): Promise<WorkBook> {
  const XLSX = await loadXlsx()
  const bytes = new Uint8Array(buffer)
  const text = decodeBufferAsText(buffer)
  const errors: string[] = []

  if (isEncryptedExcelBuffer(buffer, text)) {
    throw buildUnreadableSpreadsheetError()
  }

  if (isHtmlOrXmlSpreadsheet(text)) {
    try {
      const workbook = XLSX.read(text, { type: 'string', raw: true })
      if (workbook?.SheetNames?.length) return workbook
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'HTML 엑셀 읽기 실패')
    }
  }

  const readAttempts: Array<{ type: 'array' | 'binary' | 'string'; data: Uint8Array | string }> = [
    { type: 'array', data: bytes },
    { type: 'binary', data: arrayBufferToBinaryString(buffer) },
  ]

  if (!isZipExcel(buffer) && !isOleExcel(buffer)) {
    readAttempts.push({ type: 'string', data: text })
  }

  for (const attempt of readAttempts) {
    try {
      const workbook = XLSX.read(attempt.data, {
        type: attempt.type,
        cellDates: false,
        cellNF: false,
        cellStyles: false,
        sheetStubs: false,
        WTF: true,
      })
      if (workbook?.SheetNames?.length) return workbook
    } catch (error) {
      errors.push(error instanceof Error ? error.message : '엑셀 읽기 실패')
    }
  }

  const textRows = rowsFromText(text)
  if (textRows.length > 1) {
    if (rowsLookLikeBinaryGarbage(textRows)) {
      throw buildUnreadableSpreadsheetError()
    }
    throw new TextTableFallbackError(textRows)
  }

  throw new Error(
    errors.length
      ? `엑셀 파일을 읽을 수 없습니다. (${errors[0]}) CSV로 저장한 뒤 다시 업로드해 주세요.`
      : '엑셀 파일을 읽을 수 없습니다. CSV로 저장한 뒤 다시 업로드해 주세요.',
  )
}

class TextTableFallbackError extends Error {
  rows: string[][]

  constructor(rows: string[][]) {
    super('text-table-fallback')
    this.name = 'TextTableFallbackError'
    this.rows = rows
  }
}

/** Excel 시트(헤더 점수 기준) 또는 CSV/TSV를 2차원 배열로 읽기 */
export async function readSpreadsheetFileAsRows(
  file: File,
  kind: SpreadsheetReadKind = 'auto',
): Promise<string[][]> {
  const buffer = await file.arrayBuffer()
  const ext = file.name.toLowerCase().split('.').pop() || ''
  const excelExt = ext === 'xls' || ext === 'xlsx' || ext === 'xlsm'
  const text = decodeBufferAsText(buffer)
  const binaryExcel = isZipExcel(buffer) || isOleExcel(buffer)

  if (binaryExcel && isEncryptedExcelBuffer(buffer, text)) {
    throw buildUnreadableSpreadsheetError()
  }

  if (!excelExt && !binaryExcel && !isHtmlOrXmlSpreadsheet(text)) {
    const rows = rowsFromText(text)
    assertReadableSpreadsheetRows(rows, kind)
    return rows
  }

  if (!binaryExcel && !isHtmlOrXmlSpreadsheet(text)) {
    const textRows = rowsFromText(text)
    if (textRows.length > 1 && scoreRows(textRows, kind) > 0) {
      assertReadableSpreadsheetRows(textRows, kind)
      return textRows
    }
  }

  try {
    const workbook = await readWorkbookFromBuffer(buffer)
    const rows = await workbookToBestRows(workbook, kind)
    return rows
  } catch (error) {
    if (error instanceof TextTableFallbackError) {
      assertReadableSpreadsheetRows(error.rows, kind)
      return error.rows
    }
    throw error
  }
}

/** BOM 업로드용 — 취소선 행 인덱스 포함 */
export async function readBomSpreadsheetFile(file: File): Promise<BomSpreadsheetReadResult> {
  const buffer = await file.arrayBuffer()
  const ext = file.name.toLowerCase().split('.').pop() || ''
  const excelExt = ext === 'xls' || ext === 'xlsx' || ext === 'xlsm'
  const text = decodeBufferAsText(buffer)
  const binaryExcel = isZipExcel(buffer) || isOleExcel(buffer)

  if (binaryExcel && isEncryptedExcelBuffer(buffer, text)) {
    throw buildUnreadableSpreadsheetError()
  }

  if (!excelExt && !binaryExcel && !isHtmlOrXmlSpreadsheet(text)) {
    const rows = rowsFromText(text)
    assertReadableSpreadsheetRows(rows, 'bom')
    return { rows, struckRows: new Set<number>() }
  }

  if (!binaryExcel && isHtmlOrXmlSpreadsheet(text)) {
    const struckRawRows = detectStrikethroughRowsFromHtml(text)
    try {
      const workbook = await readWorkbookFromBuffer(buffer)
      const { rows, rawRows } = await workbookToBestSheet(workbook, 'bom')
      return {
        rows,
        struckRows: mapRawSheetStrikeRowsToFilteredRows(rawRows, struckRawRows, cellToString),
      }
    } catch (error) {
      if (error instanceof TextTableFallbackError) {
        assertReadableSpreadsheetRows(error.rows, 'bom')
        return {
          rows: error.rows,
          struckRows: mapRawSheetStrikeRowsToFilteredRows(error.rows, struckRawRows, cellToString),
        }
      }
      throw error
    }
  }

  if (!binaryExcel && !isHtmlOrXmlSpreadsheet(text)) {
    const textRows = rowsFromText(text)
    if (textRows.length > 1 && scoreRows(textRows, 'bom') > 0) {
      assertReadableSpreadsheetRows(textRows, 'bom')
      return { rows: textRows, struckRows: new Set<number>() }
    }
  }

  try {
    const workbook = await readWorkbookFromBuffer(buffer)
    const XLSX = await loadXlsx()
    const { rows, sheetIndex, rawRows } = await workbookToBestSheet(workbook, 'bom')
    const struckFromXlsx = detectStrikethroughRowsFromXlsxBuffer(buffer, sheetIndex, XLSX)
    const struckFromHtml = detectStrikethroughRowsFromHtml(text)
    const struckRawRows = new Set([...struckFromXlsx, ...struckFromHtml])
    return {
      rows,
      struckRows: mapRawSheetStrikeRowsToFilteredRows(rawRows, struckRawRows, cellToString),
    }
  } catch (error) {
    if (error instanceof TextTableFallbackError) {
      assertReadableSpreadsheetRows(error.rows, 'bom')
      return { rows: error.rows, struckRows: new Set<number>() }
    }
    throw error
  }
}

/** @deprecated 행 배열 파서 사용 권장 */
export async function readSpreadsheetFileAsCsvText(file: File): Promise<string> {
  const rows = await readSpreadsheetFileAsRows(file)
  return rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current)
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current)
  return cells.map((cell) => cell.trim())
}

export function isExcelSpreadsheetFile(file: Pick<File, 'name'>) {
  const ext = file.name.toLowerCase().split('.').pop() || ''
  return ext === 'xls' || ext === 'xlsx' || ext === 'xlsm'
}
