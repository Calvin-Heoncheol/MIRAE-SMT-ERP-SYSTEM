import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import type { FetchPostProcessPlanPageResult } from '@/lib/post-process/plan/repository'

type PostProcessPlanFetchErrorProps = {
  result: Extract<FetchPostProcessPlanPageResult, { ok: false }>
}

export function PostProcessPlanFetchError({ result }: PostProcessPlanFetchErrorProps) {
  const missingTable = result.detail.includes('post_process_production_plans')

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="후공정 생산계획을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">setup-post-process-production-plans.sql</code>을
            실행한 뒤 새로고침하세요.
          </>
        ) : null
      }
    />
  )
}
