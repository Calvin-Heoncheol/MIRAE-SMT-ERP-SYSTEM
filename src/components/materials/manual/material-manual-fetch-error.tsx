import type { FetchMaterialManualPageResult } from '@/lib/materials/manual/types'
import { isMissingMaterialOrderSetOutboundTable } from '@/lib/materials/manual/repository'

type MaterialManualFetchErrorProps = {
  result: Extract<FetchMaterialManualPageResult, { ok: false }>
}

export function MaterialManualFetchError({ result }: MaterialManualFetchErrorProps) {
  const missingOutboundTable =
    result.reason === 'query' && isMissingMaterialOrderSetOutboundTable(result.detail)

  return (
    <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-6 text-sm text-rose-900">
      <p className="font-semibold">입고 및 불출 데이터를 불러오지 못했습니다.</p>
      <p className="mt-2 whitespace-pre-wrap">{result.detail}</p>
      {missingOutboundTable ? (
        <p className="mt-3 text-xs text-rose-800">
          Supabase SQL Editor에서{' '}
          <code className="rounded bg-white/70 px-1">supabase/migrate-material-order-set-outbound.sql</code>
          을 실행한 뒤 새로고침하세요.
        </p>
      ) : null}
    </div>
  )
}
