import { SmtHistoryWorkspace } from '@/components/smt/smt-history-workspace'
import { fetchSmtProductionHistory } from '@/lib/smt/repository'

export default async function SmtHistoryPage() {
  const result = await fetchSmtProductionHistory()
  return <SmtHistoryWorkspace result={result} />
}
