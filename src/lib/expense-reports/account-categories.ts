export const EXPENSE_REPORT_ACCOUNT_CATEGORIES = [
  { value: '복리후생비', label: '복리후생비' },
  { value: '차량유지비', label: '차량유지비' },
  { value: '여비교통비', label: '여비교통비' },
  { value: '접대비', label: '접대비' },
  { value: '도서인쇄비', label: '도서인쇄비' },
  { value: '소모품비', label: '소모품비' },
  { value: '지급수수료', label: '지급수수료' },
  { value: '통신비', label: '통신비' },
  { value: '운반비', label: '운반비' },
  { value: '잡비', label: '잡비' },
  { value: '광고선전비', label: '광고선전비' },
  { value: '포장비', label: '포장비' },
  { value: '사무용품비', label: '사무용품비' },
  { value: '수선비', label: '수선비' },
] as const

export type ExpenseReportAccountCategory = (typeof EXPENSE_REPORT_ACCOUNT_CATEGORIES)[number]['value']

const ACCOUNT_CATEGORY_BY_VALUE = new Map(
  EXPENSE_REPORT_ACCOUNT_CATEGORIES.map((item) => [item.value, item]),
)

export function isExpenseReportAccountCategory(value: string): value is ExpenseReportAccountCategory {
  return ACCOUNT_CATEGORY_BY_VALUE.has(value as ExpenseReportAccountCategory)
}

export function getExpenseReportAccountCategoryLabel(value: string) {
  if (isExpenseReportAccountCategory(value)) {
    return ACCOUNT_CATEGORY_BY_VALUE.get(value)?.label ?? value
  }
  return value || '-'
}

export function normalizeExpenseReportAccountCategory(value: unknown): string {
  if (typeof value !== 'string') return ''
  const trimmed = value.trim()
  if (!trimmed) return ''
  if (isExpenseReportAccountCategory(trimmed)) return trimmed
  return trimmed
}
