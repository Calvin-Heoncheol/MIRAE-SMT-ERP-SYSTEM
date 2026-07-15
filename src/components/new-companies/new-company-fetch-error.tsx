'use client'

import type { FetchNewCompanyInquiriesResult } from '@/lib/new-companies/repository'
import { isMissingNewCompanyInquiriesTable } from '@/lib/new-companies/repository'

type NewCompanyFetchErrorProps = {
  result: Extract<FetchNewCompanyInquiriesResult, { ok: false }>
}

export function NewCompanyFetchError({ result }: NewCompanyFetchErrorProps) {
  const missingTable = isMissingNewCompanyInquiriesTable(result.detail)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">신규업체 목록을 불러오지 못했습니다</p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {missingTable ? (
        <p className="mt-3 text-xs text-amber-800">
          Supabase에서 <code className="rounded bg-amber-100 px-1">supabase/setup-new-company-inquiries.sql</code> 을
          실행해 주세요.
        </p>
      ) : null}
    </div>
  )
}
