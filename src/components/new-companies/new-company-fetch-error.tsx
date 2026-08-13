'use client'

import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import type { FetchNewCompanyInquiriesResult } from '@/lib/new-companies/repository'
import { isMissingNewCompanyInquiriesTable } from '@/lib/new-companies/repository'

type NewCompanyFetchErrorProps = {
  result: Extract<FetchNewCompanyInquiriesResult, { ok: false }>
}

export function NewCompanyFetchError({ result }: NewCompanyFetchErrorProps) {
  const missingTable = isMissingNewCompanyInquiriesTable(result.detail)

  return (
    <FetchErrorBanner
      title="신규업체 목록을 불러오지 못했습니다"
      detail={result.detail}
      hint={
        missingTable ? (
          <>
            Supabase에서 <code className="rounded bg-white/70 px-1">supabase/setup-new-company-inquiries.sql</code> 을
            실행해 주세요.
          </>
        ) : null
      }
    />
  )
}
