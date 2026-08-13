import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { isMissingBomTable, type FetchBomResult } from '@/lib/bom/repository'

export function BomFetchError({
  result,
}: {
  result: Extract<FetchBomResult, { ok: false }>
}) {
  const missingTable = isMissingBomTable(result.detail)

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="BOM 목록을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">supabase/setup-bom.sql</code>을 실행해 주세요.
          </>
        ) : null
      }
    />
  )
}
