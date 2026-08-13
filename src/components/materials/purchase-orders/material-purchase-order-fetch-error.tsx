import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import {
  isMissingMaterialPurchaseOrdersTable,
  type FetchMaterialPurchaseHistoryResult,
  type FetchMaterialPurchaseOrdersResult,
  type FetchMaterialPurchaseRegisterResult,
} from '@/lib/materials/purchase-orders/repository'

type FetchErrorResult =
  | Extract<FetchMaterialPurchaseRegisterResult, { ok: false }>
  | Extract<FetchMaterialPurchaseOrdersResult, { ok: false }>
  | Extract<FetchMaterialPurchaseHistoryResult, { ok: false }>

export function MaterialPurchaseOrderFetchError({ result }: { result: FetchErrorResult }) {
  const missingTable = isMissingMaterialPurchaseOrdersTable(result.detail)

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="구매발주 목록을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">supabase/setup-material-purchase-orders.sql</code>을
            실행해 주세요.
          </>
        ) : null
      }
    />
  )
}
