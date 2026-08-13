import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { isMissingBusinessPartnersTable, type FetchBusinessPartnersResult } from '@/lib/partners/repository'

export function PartnerFetchError({
  result,
}: {
  result: Extract<FetchBusinessPartnersResult, { ok: false }>
}) {
  const missingTable = isMissingBusinessPartnersTable(result.detail)

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="거래처 목록을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">supabase/setup-business-partners.sql</code>을 실행해
            주세요. 스키마가 맞지 않으면 <code className="rounded bg-white/70 px-1">supabase/reset-erp.sql</code>{' '}
            후 setup 스크립트를 다시 실행하세요.
          </>
        ) : null
      }
    />
  )
}
