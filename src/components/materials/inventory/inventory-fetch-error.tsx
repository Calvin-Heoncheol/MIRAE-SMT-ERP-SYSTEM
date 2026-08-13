import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
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
    <FetchErrorBanner
      reason={result.reason}
      title="재고 현황을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">supabase/setup-items.sql</code>,{' '}
            <code className="rounded bg-white/70 px-1">supabase/setup-material-purchase-orders.sql</code>,{' '}
            <code className="rounded bg-white/70 px-1">supabase/setup-material-inbound.sql</code>을 실행해
            주세요.
          </>
        ) : null
      }
    />
  )
}
