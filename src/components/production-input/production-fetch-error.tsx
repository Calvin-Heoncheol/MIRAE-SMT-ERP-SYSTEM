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
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : config.fetchErrorTitle}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
    </div>
  )
}
