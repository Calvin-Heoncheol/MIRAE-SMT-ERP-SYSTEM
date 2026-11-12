import { QuoteRateWorkspace } from '@/components/quotes/quote-rate-workspace'
import { fetchQuoteRateHistory } from '@/lib/quotes/rate-repository'

export const dynamic = 'force-dynamic'

export default async function QuoteRatesPage() {
  const result = await fetchQuoteRateHistory()
  return <QuoteRateWorkspace result={result} />
}
