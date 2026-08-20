import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import type { FetchSolderCreamLogPageResult } from '@/lib/materials/solder-cream/repository'
import { isMissingSolderCreamLogTable } from '@/lib/materials/solder-cream/utils'

export function SolderCreamLogFetchError({
  result,
}: {
  result: Extract<FetchSolderCreamLogPageResult, { ok: false }>
}) {
  const missingTable = isMissingSolderCreamLogTable(result.detail)

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="솔더페이스트를 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">
              supabase/setup-solder-cream-equipment-logs.sql
            </code>
            을 실행해 주세요.
          </>
        ) : null
      }
    />
  )
}
