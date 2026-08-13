import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import type { FetchProductionInputPageResult } from '@/lib/production-input/repository'
import type { ProductionInputConfig } from '@/lib/production-input/types'

export function ProductionFetchError({
  result,
  config,
}: {
  result: Extract<FetchProductionInputPageResult, { ok: false }>
  config: Pick<ProductionInputConfig, 'fetchErrorTitle'>
}) {
  return (
    <FetchErrorBanner
      reason={result.reason}
      title={config.fetchErrorTitle}
      detail={result.detail}
    />
  )
}
