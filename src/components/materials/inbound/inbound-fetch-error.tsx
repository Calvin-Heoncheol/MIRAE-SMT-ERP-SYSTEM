import { isMissingMaterialInboundTable, type FetchMaterialInboundPageResult } from '@/lib/materials/inbound/repository'

export function InboundFetchError({
  result,
}: {
  result: Extract<FetchMaterialInboundPageResult, { ok: false }>
}) {
  const missingTable = isMissingMaterialInboundTable(result.detail)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : '입고 목록을 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {missingTable ? (
        <p className="mt-3 text-xs text-amber-800">
          Supabase SQL Editor에서{' '}
          <code className="rounded bg-white/70 px-1">supabase/setup-material-inbound.sql</code>을 실행한 뒤,
          Supabase Dashboard → Settings → API에서 schema cache를 새로고침해 주세요. 스키마가 맞지 않으면{' '}
          <code className="rounded bg-white/70 px-1">supabase/reset-erp.sql</code> 후 setup 스크립트를 다시
          실행하세요.
        </p>
      ) : null}
    </div>
  )
}
