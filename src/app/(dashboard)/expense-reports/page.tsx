import { ExpenseReportsWorkspace } from '@/components/expense-reports/expense-reports-workspace'
import { fetchExpenseReports } from '@/lib/expense-reports/repository'

export default async function ExpenseReportsPage() {
  const result = await fetchExpenseReports()
  return <ExpenseReportsWorkspace result={result} />
}
