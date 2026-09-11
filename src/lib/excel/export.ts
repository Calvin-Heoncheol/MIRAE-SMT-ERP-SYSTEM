import { todayYmdSeoul } from '@/lib/orders/utils'

/** xlsx-js-style 셀 스타일 (배경·글꼴 등) */
export type ExcelCellStyle = {
  fill?: {
    patternType?: 'solid' | 'none'
    fgColor?: { rgb: string }
    bgColor?: { rgb: string }
  }
  font?: {
    bold?: boolean
    color?: { rgb: string }
    sz?: number
  }
  alignment?: {
    horizontal?: 'left' | 'center' | 'right'
    vertical?: 'top' | 'center' | 'bottom'
    wrapText?: boolean
  }
}

export type ExcelColumn<T> = {
  header: string
  value: (row: T) => string | number
  /** 열 너비 (문자 수) */
  width?: number
  /** 행별 셀 스타일 — 있으면 해당 셀에 적용 */
  cellStyle?: (row: T) => ExcelCellStyle | undefined | null
}

export type ExcelSheet<T> = {
  sheetName: string
  columns: ExcelColumn<T>[]
  rows: T[]
}

type DownloadExcelOptions<T> = {
  /** 확장자 제외 — 뒤에 _날짜.xlsx 가 붙음 */
  fileName: string
  sheetName: string
  columns: ExcelColumn<T>[]
  rows: T[]
}

type DownloadExcelSheetsOptions = {
  /** 확장자 제외 — 뒤에 _날짜.xlsx 가 붙음 */
  fileName: string
  // 시트마다 행 타입이 달라 unknown 허용
  sheets: ExcelSheet<never>[] | { sheetName: string; columns: ExcelColumn<unknown>[]; rows: unknown[] }[]
}

type ExcelCellObject = {
  v: string | number
  t: 's' | 'n'
  s?: ExcelCellStyle
}

function toExcelCell(value: string | number, style?: ExcelCellStyle | null): ExcelCellObject {
  const cell: ExcelCellObject = {
    v: value,
    t: typeof value === 'number' ? 'n' : 's',
  }
  if (style) cell.s = style
  return cell
}

/** 여러 시트를 가진 엑셀(.xlsx) 다운로드. 브라우저 전용 */
export async function downloadExcelSheets({ fileName, sheets }: DownloadExcelSheetsOptions) {
  const XLSX = await import('xlsx-js-style')
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets as { sheetName: string; columns: ExcelColumn<unknown>[]; rows: unknown[] }[]) {
    const aoa: ExcelCellObject[][] = [
      sheet.columns.map((column) => toExcelCell(column.header, { font: { bold: true } })),
      ...sheet.rows.map((row) =>
        sheet.columns.map((column) => toExcelCell(column.value(row), column.cellStyle?.(row))),
      ),
    ]
    const worksheet = XLSX.utils.aoa_to_sheet(aoa)
    worksheet['!cols'] = sheet.columns.map((column) => ({
      wch: column.width ?? Math.max(column.header.length * 2, 10),
    }))
    XLSX.utils.book_append_sheet(workbook, worksheet, sheet.sheetName)
  }

  XLSX.writeFile(workbook, `${fileName}_${todayYmdSeoul()}.xlsx`)
}

/** 목록을 엑셀(.xlsx)로 다운로드. 브라우저 전용 */
export async function downloadExcel<T>({
  fileName,
  sheetName,
  columns,
  rows,
}: DownloadExcelOptions<T>) {
  await downloadExcelSheets({
    fileName,
    sheets: [{ sheetName, columns: columns as ExcelColumn<unknown>[], rows: rows as unknown[] }],
  })
}
