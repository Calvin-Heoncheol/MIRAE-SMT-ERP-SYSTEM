export const EXPENSE_REPORT_PROCESSING_METHODS = [
  { value: 'cash', label: '시재(현금)' },
  { value: 'card', label: '카드' },
] as const

export type ExpenseReportProcessingMethod = (typeof EXPENSE_REPORT_PROCESSING_METHODS)[number]['value']

const PROCESSING_METHOD_BY_VALUE = new Map(
  EXPENSE_REPORT_PROCESSING_METHODS.map((item) => [item.value, item]),
)

const LEGACY_PROCESSING_METHOD_LABELS: Record<string, ExpenseReportProcessingMethod> = {
  cash: 'cash',
  card: 'card',
  '시재(현금)': 'cash',
  시재: 'cash',
  현금: 'cash',
  카드: 'card',
}

export function isExpenseReportProcessingMethod(value: string): value is ExpenseReportProcessingMethod {
  return PROCESSING_METHOD_BY_VALUE.has(value as ExpenseReportProcessingMethod)
}

export function getExpenseReportProcessingMethodLabel(value: string) {
  if (isExpenseReportProcessingMethod(value)) {
    return PROCESSING_METHOD_BY_VALUE.get(value)?.label ?? value
  }
  return value || '-'
}

export function normalizeExpenseReportProcessingMethod(value: unknown): ExpenseReportProcessingMethod {
  if (typeof value !== 'string') return 'cash'
  const trimmed = value.trim()
  if (isExpenseReportProcessingMethod(trimmed)) return trimmed
  return LEGACY_PROCESSING_METHOD_LABELS[trimmed] ?? 'cash'
}
