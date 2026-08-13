import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import type { FetchDeliveryHistoryResult } from '@/lib/delivery/repository'
import { isMissingDeliveryTable } from '@/lib/delivery/repository'

export function DeliveryHistoryFetchError({
  result,
}: {
  result: Extract<FetchDeliveryHistoryResult, { ok: false }>
}) {
  const missingTable = result.reason === 'query' && isMissingDeliveryTable(result.detail)

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="출하이력을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">setup-delivery-production.sql</code>을 실행했는지
            확인하세요.
          </>
        ) : null
      }
    />
  )
}
