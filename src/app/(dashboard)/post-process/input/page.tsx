import { ProductionInputWorkspace } from '@/components/production-input/production-input-workspace'
import { fetchProductionInputPageData } from '@/lib/production-input/repository'
import { POST_PROCESS_PRODUCTION_INPUT_CONFIG } from '@/lib/post-process/config'

export const dynamic = 'force-dynamic'

export default async function PostProcessInputPage() {
  const result = await fetchProductionInputPageData(POST_PROCESS_PRODUCTION_INPUT_CONFIG)
  return <ProductionInputWorkspace result={result} config={POST_PROCESS_PRODUCTION_INPUT_CONFIG} />
}
