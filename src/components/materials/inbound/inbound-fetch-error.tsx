import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { isMissingMaterialInboundTable, type FetchMaterialInboundPageResult } from '@/lib/materials/inbound/repository'

export function InboundFetchError({
  result,
}: {
  result: Extract<FetchMaterialInboundPageResult, { ok: false }>
}) {
  const missingTable = isMissingMaterialInboundTable(result.detail)

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="입고 목록을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">supabase/setup-material-inbound.sql</code>을 실행한 뒤,
            Supabase Dashboard → Settings → API에서 schema cache를 새로고침해 주세요. 스키마가 맞지 않으면{' '}
            <code className="rounded bg-white/70 px-1">supabase/reset-erp.sql</code> 후 setup 스크립트를 다시
            실행하세요.
          </>
        ) : null
      }
    />
  )
}
