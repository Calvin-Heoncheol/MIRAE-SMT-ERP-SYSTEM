'use client'

import type { FetchMaterialOutboundPageResult } from '@/lib/materials/outbound/repository'

type OutboundFetchErrorProps = {
  result: Extract<FetchMaterialOutboundPageResult, { ok: false }>
}

export function OutboundFetchError({ result }: OutboundFetchErrorProps) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : '불출 데이터를 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {result.reason === 'query' ? (
        <p className="mt-3 text-xs text-amber-800">
          Supabase에서 <code className="rounded bg-amber-100 px-1">setup-material-outbound.sql</code> 을
          실행했는지 확인해 주세요.
        </p>
      ) : null}
    </div>
  )
}
