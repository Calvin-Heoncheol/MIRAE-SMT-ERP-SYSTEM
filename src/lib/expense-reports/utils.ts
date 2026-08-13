import { normalizeApprovalDepartment } from '@/lib/approvals/departments'
import { normalizeExpenseReportAccountCategory } from './account-categories'
import { normalizeExpenseReportProcessingMethod } from './processing-methods'
import { normalizeSignoffs } from '@/lib/approvals/signoffs'
import type { ExpenseReportListItem, ExpenseReportRecord } from './types'

function normalizeDetailInfo(raw: ExpenseReportRecord['detail_info']) {
  return {
    lineItems: Array.isArray(raw?.lineItems)
      ? raw.lineItems
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            accountCategory: normalizeExpenseReportAccountCategory(
              (item as { accountCategory?: string }).accountCategory,
            ),
            description: String((item as { description?: string }).description ?? ''),
            amount: String((item as { amount?: string }).amount ?? ''),
            note: String((item as { note?: string }).note ?? ''),
          }))
      : [],
    attachments: String(raw?.attachments ?? ''),
    attachmentFiles: Array.isArray(raw?.attachmentFiles)
      ? raw.attachmentFiles
          .filter((item) => item && typeof item === 'object')
          .map((item) => ({
            id: String((item as { id?: string }).id ?? ''),
            name: String((item as { name?: string }).name ?? ''),
            path: String((item as { path?: string }).path ?? ''),
            size: Number((item as { size?: number }).size) || 0,
            mimeType: String((item as { mimeType?: string }).mimeType ?? ''),
            uploadedAt: String((item as { uploadedAt?: string }).uploadedAt ?? ''),
          }))
          .filter((item) => item.id && item.path && item.name)
      : [],
    remarks: String(raw?.remarks ?? ''),
    signoffs: normalizeSignoffs(raw?.signoffs),
  }
}

export function mapExpenseReportRecord(record: ExpenseReportRecord): ExpenseReportListItem {
  return {
    id: record.id,
    docNumber: record.doc_number || record.id,
    writtenDate: record.written_date,
    department: normalizeApprovalDepartment(record.department),
    author: record.author,
    createdByName: String(record.created_by_name || '').trim(),
    accountCategory: record.account_category,
    processingDetails: normalizeExpenseReportProcessingMethod(record.processing_details),
    approvalDate: record.approval_date ?? '',
    expenditureDate: record.expenditure_date ?? '',
    recipient: record.recipient,
    receiptDate: record.receipt_date ?? '',
    totalAmount: Number(record.total_amount) || 0,
    detailInfo: normalizeDetailInfo(record.detail_info),
  }
}

export function sortExpenseReportsNewestFirst(items: ExpenseReportListItem[]) {
  return [...items].sort((a, b) => {
    const dateCompare = b.writtenDate.localeCompare(a.writtenDate)
    if (dateCompare !== 0) return dateCompare
    return b.docNumber.localeCompare(a.docNumber)
  })
}

export function formatExpenseReportMoney(amount: number) {
  return `₩${Math.round(amount).toLocaleString('ko-KR')}`
}

const KOREAN_DIGITS = ['', '일', '이', '삼', '사', '오', '육', '칠', '팔', '구']
const KOREAN_SMALL_UNITS = ['', '십', '백', '천']
const KOREAN_LARGE_UNITS = ['', '만', '억', '조']

function readKoreanNumberChunk(value: number) {
  if (value <= 0) return ''
  let chunk = ''
  let remaining = value
  for (let unitIndex = 0; unitIndex < KOREAN_SMALL_UNITS.length; unitIndex += 1) {
    const digit = remaining % 10
    if (digit > 0) {
      chunk = `${KOREAN_DIGITS[digit]}${KOREAN_SMALL_UNITS[unitIndex]}${chunk}`
    }
    remaining = Math.floor(remaining / 10)
  }
  return chunk
}

export function formatKoreanMoneyText(amount: number) {
  const rounded = Math.round(amount)
  if (rounded <= 0) return '영원정'

  let remaining = rounded
  let text = ''
  for (let unitIndex = 0; unitIndex < KOREAN_LARGE_UNITS.length && remaining > 0; unitIndex += 1) {
    const chunk = remaining % 10000
    if (chunk > 0) {
      const chunkText = readKoreanNumberChunk(chunk)
      text = `${chunkText}${KOREAN_LARGE_UNITS[unitIndex]}${text}`
    }
    remaining = Math.floor(remaining / 10000)
  }

  return `금${text}원정`
}

export { getSignoffStatusLabel } from '@/lib/approvals/signoffs'
