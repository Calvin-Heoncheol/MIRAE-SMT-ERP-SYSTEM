'use client'

import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import type { FetchMaterialOutboundPageResult } from '@/lib/materials/outbound/repository'

type OutboundFetchErrorProps = {
  result: Extract<FetchMaterialOutboundPageResult, { ok: false }>
}

export function OutboundFetchError({ result }: OutboundFetchErrorProps) {
  return (
    <FetchErrorBanner
      reason={result.reason}
      title="불출 데이터를 불러오지 못했습니다"
      detail={result.detail}
      hint={
        result.reason === 'query' ? (
          <>
            Supabase에서 <code className="rounded bg-white/70 px-1">setup-material-outbound.sql</code> 을
            실행했는지 확인해 주세요.
          </>
        ) : null
      }
    />
  )
}
