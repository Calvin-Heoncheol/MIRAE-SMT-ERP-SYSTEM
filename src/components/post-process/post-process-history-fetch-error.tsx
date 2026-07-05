import type { FetchPostProcessProductionHistoryResult } from '@/lib/post-process/repository'
import { isMissingPostProcessProductionTable } from '@/lib/post-process/repository'

export function PostProcessHistoryFetchError({
  result,
}: {
  result: Extract<FetchPostProcessProductionHistoryResult, { ok: false }>
}) {
  const missingTable = result.reason === 'query' && isMissingPostProcessProductionTable(result.detail)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : '후공정 생산이력을 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {missingTable ? (
        <p className="mt-3 text-amber-800">
          Supabase SQL Editor에서{' '}
          <code className="rounded bg-amber-100 px-1">setup-post-process-production.sql</code>을 실행했는지
          확인하세요.
        </p>
      ) : null}
    </div>
  )
}
