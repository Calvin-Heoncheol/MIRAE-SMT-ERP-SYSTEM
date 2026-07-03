import type { FetchPostProcessPageResult } from '@/lib/post-process/repository'

export function PostFetchError({ result }: { result: Extract<FetchPostProcessPageResult, { ok: false }> }) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : '후공정 데이터를 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
    </div>
  )
}
