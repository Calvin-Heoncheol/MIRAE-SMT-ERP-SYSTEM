import {
  isMissingMaterialInventoryTables,
  type FetchMaterialInventoryResult,
} from '@/lib/materials/inventory/repository'

export function InventoryFetchError({
  result,
}: {
  result: Extract<FetchMaterialInventoryResult, { ok: false }>
}) {
  const missingTable = isMissingMaterialInventoryTables(result.detail)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : '재고 현황을 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {missingTable ? (
        <p className="mt-3 text-xs text-amber-800">
          Supabase SQL Editor에서{' '}
          <code className="rounded bg-white/70 px-1">supabase/setup-items.sql</code>,{' '}
          <code className="rounded bg-white/70 px-1">supabase/setup-material-purchase-orders.sql</code>,{' '}
          <code className="rounded bg-white/70 px-1">supabase/setup-material-inbound.sql</code>을 실행해
          주세요.
        </p>
      ) : null}
    </div>
  )
}
