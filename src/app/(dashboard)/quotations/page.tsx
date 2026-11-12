import { QuotationsWorkspace } from '@/components/quotes/quotations-workspace'
import { fetchCurrentQuoteRates } from '@/lib/quotes/rate-repository'
import { fetchQuotes } from '@/lib/quotes/repository'

export default async function QuotationsPage() {
  const [result, currentRates] = await Promise.all([fetchQuotes(), fetchCurrentQuoteRates()])
  return <QuotationsWorkspace result={result} currentRates={currentRates} />
}
