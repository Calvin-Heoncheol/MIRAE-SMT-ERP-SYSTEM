'use client'

import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import type { FetchApprovalsResult } from '@/lib/approvals/repository'

export function ApprovalFetchError({ result }: { result: Extract<FetchApprovalsResult, { ok: false }> }) {
  return (
    <FetchErrorBanner
      reason={result.reason}
      title="품의서 목록을 불러오지 못했습니다"
      detail={
        result.reason === 'env'
          ? 'Supabase 환경 변수를 확인해 주세요.'
          : result.detail
      }
      hint={
        result.reason === 'query' ? (
          <>
            <p>Supabase SQL Editor에서 아래 순서로 실행해 주세요.</p>
            <p>1. `supabase/setup-approvals.sql`</p>
            <p>2. `supabase/setup-approvals-storage.sql` (첨부파일용)</p>
          </>
        ) : null
      }
    />
  )
}
