import { downloadExcel, type ExcelCellStyle, type ExcelColumn } from '@/lib/excel/export'
import type { MonthlyClosingRow } from '@/lib/reports/monthly-closing'
import { summarizeMonthlyClosingRows } from '@/lib/reports/monthly-closing'
import {
  buildMonthlyClosingPdfTitle,
  type ExportMonthlyClosingPdfInput,
} from '@/lib/reports/export-monthly-closing-pdf'

type ClosingExcelRow = {
  recordDate: string
  orderNumber: string
  shipmentId: string
  productCode: string
  productName: string
  quantity: number | string
  unitPrice: number | string
  amount: number
  vat: string
  isTotal?: boolean
}

const TOTAL_STYLE: ExcelCellStyle = {
  font: { bold: true },
  fill: { patternType: 'solid', fgColor: { rgb: 'F1F5F9' } },
}

export async function exportMonthlyClosingExcel(input: ExportMonthlyClosingPdfInput) {
  if (!input.rows.length) return false

  const totals = summarizeMonthlyClosingRows(input.rows)
  const vatRowCount = input.rows.filter((row) => row.vatIncluded).length
  const allVatIncluded = vatRowCount === input.rows.length
  const mixedVat = vatRowCount > 0 && !allVatIncluded
  const vatSuffix = allVatIncluded ? ' (VAT INC.)' : ''

  const rows: ClosingExcelRow[] = input.rows.map((row: MonthlyClosingRow) => ({
    recordDate: row.recordDate || '',
    orderNumber: row.orderNumber || '',
    shipmentId: row.shipmentId || '',
    productCode: row.productCode || '',
    productName: row.productName || '',
    quantity: row.quantity,
    unitPrice: row.unitPrice,
    amount: row.amount,
    vat: row.vatIncluded ? '포함' : '별도',
  }))
  rows.push({
    recordDate: '합계',
    orderNumber: '',
    shipmentId: '',
    productCode: '',
    productName: '',
    quantity: totals.quantity,
    unitPrice: '',
    amount: totals.amount,
    vat: '',
    isTotal: true,
  })

  const totalStyle = (row: ClosingExcelRow) => (row.isTotal ? TOTAL_STYLE : null)

  const columns: ExcelColumn<ClosingExcelRow>[] = [
    { header: '일자', value: (row) => row.recordDate, width: 12, cellStyle: totalStyle },
    { header: '발주번호', value: (row) => row.orderNumber, width: 18, cellStyle: totalStyle },
    { header: '출하번호', value: (row) => row.shipmentId, width: 18, cellStyle: totalStyle },
    { header: '품목코드', value: (row) => row.productCode, width: 18, cellStyle: totalStyle },
    { header: '품목명', value: (row) => row.productName, width: 36, cellStyle: totalStyle },
    { header: '수량', value: (row) => row.quantity, width: 10, cellStyle: totalStyle },
    { header: `단가${vatSuffix}`, value: (row) => row.unitPrice, width: 16, cellStyle: totalStyle },
    { header: `합계${vatSuffix}`, value: (row) => row.amount, width: 18, cellStyle: totalStyle },
  ]
  if (mixedVat) {
    columns.push({ header: 'VAT', value: (row) => row.vat, width: 8, cellStyle: totalStyle })
  }

  await downloadExcel({
    fileName: buildMonthlyClosingPdfTitle(input),
    sheetName: '월마감',
    columns,
    rows,
  })
  return true
}
