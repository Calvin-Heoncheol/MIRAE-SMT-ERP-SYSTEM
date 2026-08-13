import type { FetchPostProcessPlanPageResult } from '@/lib/post-process/plan/repository'

type PostProcessPlanFetchErrorProps = {
  result: Extract<FetchPostProcessPlanPageResult, { ok: false }>
}

export function PostProcessPlanFetchError({ result }: PostProcessPlanFetchErrorProps) {
  const missingTable = result.detail.includes('post_process_production_plans')

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : '후공정 생산계획을 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {missingTable ? (
        <p className="mt-3 text-xs text-amber-800">
          Supabase SQL Editor에서{' '}
          <code className="rounded bg-amber-100 px-1">setup-post-process-production-plans.sql</code>을
          실행한 뒤 새로고침하세요.
        </p>
      ) : null}
    </div>
  )
}
