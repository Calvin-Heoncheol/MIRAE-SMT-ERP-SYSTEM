import type { FetchItemsResult } from '@/lib/items/repository'
import { isMissingItemsTable } from '@/lib/items/repository'

type ItemFetchErrorProps = {
  result: Extract<FetchItemsResult, { ok: false }>
}

export function ItemFetchError({ result }: ItemFetchErrorProps) {
  const missingTable = result.reason === 'query' && isMissingItemsTable(result.detail)

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-4 text-sm text-red-800">
      <p className="font-semibold">품목 목록을 불러오지 못했습니다.</p>
      <p className="mt-1 text-red-700">{result.detail}</p>
      {missingTable ? (
        <p className="mt-3 text-red-700">
          Supabase SQL Editor에서{' '}
          <code className="rounded bg-white/70 px-1">supabase/setup-items.sql</code>을 실행해 주세요.
          스키마가 맞지 않으면 <code className="rounded bg-white/70 px-1">supabase/reset-erp.sql</code> 후
          setup 스크립트를 다시 실행하세요.
        </p>
      ) : null}
    </div>
  )
}
