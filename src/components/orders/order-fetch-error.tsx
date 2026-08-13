import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { isMissingOrdersTable, type FetchOrdersResult } from '@/lib/orders/repository'

export function OrderFetchError({ result }: { result: Extract<FetchOrdersResult, { ok: false }> }) {
  const missingTable = isMissingOrdersTable(result.detail)
  const productFkIssue = result.detail.includes('order_lines_product_id_fkey')

  return (
    <FetchErrorBanner
      reason={result.reason}
      title="발주 목록을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase SQL Editor에서 <code className="rounded bg-white/70 px-1">supabase/setup-orders.sql</code>과{' '}
            <code className="rounded bg-white/70 px-1">supabase/setup-items.sql</code>을 실행해 주세요.
          </>
        ) : productFkIssue ? (
          <>
            <code className="rounded bg-white/70 px-1">supabase/setup-items.sql</code> 하단 FK 교체 구문을 실행해
            주세요.
          </>
        ) : null
      }
    />
  )
}
