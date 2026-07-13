import { ProductionInputWorkspace } from '@/components/production-input/production-input-workspace'
import { fetchProductionInputPageData } from '@/lib/production-input/repository'
import { SMT_PRODUCTION_INPUT_CONFIG } from '@/lib/smt/config'

export const dynamic = 'force-dynamic'

export default async function SmtInputPage() {
  const result = await fetchProductionInputPageData(SMT_PRODUCTION_INPUT_CONFIG)
  return <ProductionInputWorkspace result={result} config={SMT_PRODUCTION_INPUT_CONFIG} />
}
