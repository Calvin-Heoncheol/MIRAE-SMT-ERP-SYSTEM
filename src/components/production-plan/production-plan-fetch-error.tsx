import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { isMissingProductionPlanBoardTable } from '@/lib/production-plan/repository'
import type { FetchProductionPlanBoardResult } from '@/lib/production-plan/types'

type ProductionPlanFetchErrorProps = {
  result: Extract<FetchProductionPlanBoardResult, { ok: false }>
}

export function ProductionPlanFetchError({ result }: ProductionPlanFetchErrorProps) {
  const missingTable = isMissingProductionPlanBoardTable(result.detail)

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="생산계획을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">migrate-production-plan-board.sql</code>을 실행한 뒤
            새로고침하세요.
          </>
        ) : null
      }
    />
  )
}
