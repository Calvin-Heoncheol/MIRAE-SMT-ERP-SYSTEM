import { QuotationsWorkspace } from '@/components/quotes/quotations-workspace'
import { fetchQuotes } from '@/lib/quotes/repository'

export default async function QuotationsPage() {
  const result = await fetchQuotes()
  return <QuotationsWorkspace result={result} />
}
