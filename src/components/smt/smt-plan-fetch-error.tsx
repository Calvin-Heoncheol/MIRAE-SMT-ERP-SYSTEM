import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import type { FetchSmtPlanPageResult } from '@/lib/smt/plan/repository'

type SmtPlanFetchErrorProps = {
  result: Extract<FetchSmtPlanPageResult, { ok: false }>
}

export function SmtPlanFetchError({ result }: SmtPlanFetchErrorProps) {
  const missingTable = result.detail.includes('smt_production_plans')

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="SMT 생산계획을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서 <code className="rounded bg-white/70 px-1">setup-smt-production-plans.sql</code>을
            실행한 뒤 새로고침하세요.
          </>
        ) : null
      }
    />
  )
}
