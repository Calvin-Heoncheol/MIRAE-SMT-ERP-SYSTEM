import type { FetchSmtPlanPageResult } from '@/lib/smt/plan/repository'

type SmtPlanFetchErrorProps = {
  result: Extract<FetchSmtPlanPageResult, { ok: false }>
}

export function SmtPlanFetchError({ result }: SmtPlanFetchErrorProps) {
  const missingTable = result.detail.includes('smt_production_plans')

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : 'SMT 생산계획을 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {missingTable ? (
        <p className="mt-3 text-xs text-amber-800">
          Supabase SQL Editor에서 <code className="rounded bg-amber-100 px-1">setup-smt-production-plans.sql</code>을
          실행한 뒤 새로고침하세요.
        </p>
      ) : null}
    </div>
  )
}
