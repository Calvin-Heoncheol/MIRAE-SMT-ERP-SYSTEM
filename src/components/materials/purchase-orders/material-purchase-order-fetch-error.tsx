import {
  isMissingMaterialPurchaseOrdersTable,
  type FetchMaterialPurchaseByOrderResult,
  type FetchMaterialPurchaseHistoryResult,
  type FetchMaterialPurchaseRegisterResult,
} from '@/lib/materials/purchase-orders/repository'

type FetchErrorResult =
  | Extract<FetchMaterialPurchaseRegisterResult, { ok: false }>
  | Extract<FetchMaterialPurchaseByOrderResult, { ok: false }>
  | Extract<FetchMaterialPurchaseHistoryResult, { ok: false }>

export function MaterialPurchaseOrderFetchError({ result }: { result: FetchErrorResult }) {
  const missingTable = isMissingMaterialPurchaseOrdersTable(result.detail)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : '자재 발주 목록을 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {missingTable ? (
        <p className="mt-3 text-xs text-amber-800">
          Supabase SQL Editor에서{' '}
          <code className="rounded bg-white/70 px-1">supabase/setup-material-purchase-orders.sql</code>을
          실행해 주세요.
        </p>
      ) : null}
    </div>
  )
}
