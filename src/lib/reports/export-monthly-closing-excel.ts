import { downloadExcel, type ExcelCellStyle } from '@/lib/excel/export'
import type { MonthlyClosingRow } from '@/lib/reports/monthly-closing'
import { summarizeMonthlyClosingRows } from '@/lib/reports/monthly-closing'
import {
  buildMonthlyClosingPdfTitle,
  type ExportMonthlyClosingPdfInput,
} from '@/lib/reports/export-monthly-closing-pdf'

type ClosingExcelRow = {
  recordDate: string
  productCode: string
  productName: string
  quantity: number | string
  unitPrice: number | string
  amount: number
  isTotal?: boolean
}

const TOTAL_STYLE: ExcelCellStyle = {
  font: { bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
}

export async function exportMonthlyClosingExcel(input: ExportMonthlyClosingPdfInput) {
  if (!input.rows.length) return false

  const totals = summarizeMonthlyClosingRows(input.rows)
  const rows: ClosingExcelRow[] = input.rows.map((row: MonthlyClosingRow) => ({
    recordDate: row.recordDate || '',
    productCode: row.productCode || '',
    productName: row.productName || '',
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    amount: row.amount,
  }))
  rows.push({
    recordDate: '합계',
    productCode: '',
    productName: '',
    quantity: totals.quantity,
    unitPrice: '',
    amount: totals.amount,
    isTotal: true,
  })

  const totalStyle = (row: ClosingExcelRow) => (row.isTotal ? TOTAL_STYLE : null)

  await downloadExcel({
    fileName: buildMonthlyClosingPdfTitle(input),
    sheetName: '월마감',
    columns: [
      { header: '일자', value: (row: ClosingExcelRow) => row.recordDate, width: 12, cellStyle: totalStyle },
      { header: '품목코드', value: (row) => row.productCode, width: 18, cellStyle: totalStyle },
      { header: '품목명', value: (row) => row.productName, width: 36, cellStyle: totalStyle },
      { header: '수량', value: (row) => row.quantity, width: 10, cellStyle: totalStyle },
      { header: '단가', value: (row) => row.unitPrice, width: 12, cellStyle: totalStyle },
      { header: '합계', value: (row) => row.amount, width: 14, cellStyle: totalStyle },
    ],
    rows,
  })
  return true
}
