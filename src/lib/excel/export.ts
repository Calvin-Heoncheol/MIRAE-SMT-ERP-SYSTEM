import { todayYmdSeoul } from '@/lib/orders/utils'

export type ExcelColumn<T> = {
  header: string
  value: (row: T) => string | number
  /** 열 너비 (문자 수) */
  width?: number
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

/** 여러 시트를 가진 엑셀(.xlsx) 다운로드. 브라우저 전용 */
export async function downloadExcelSheets({ fileName, sheets }: DownloadExcelSheetsOptions) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.utils.book_new()

  for (const sheet of sheets as { sheetName: string; columns: ExcelColumn<unknown>[]; rows: unknown[] }[]) {
    const aoa: (string | number)[][] = [
      sheet.columns.map((column) => column.header),
      ...sheet.rows.map((row) => sheet.columns.map((column) => column.value(row))),
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
