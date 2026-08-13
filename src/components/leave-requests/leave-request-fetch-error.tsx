'use client'

import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import type { FetchLeaveRequestsResult } from '@/lib/leave-requests/repository'

export function LeaveRequestFetchError({ result }: { result: Extract<FetchLeaveRequestsResult, { ok: false }> }) {
  return (
    <FetchErrorBanner
      reason={result.reason}
      title="휴가원 목록을 불러오지 못했습니다"
      detail={
        result.reason === 'env'
          ? 'Supabase 환경 변수를 확인해 주세요.'
          : result.detail
      }
      hint={
        result.reason === 'query' ? (
          <p>Supabase SQL Editor에서 `supabase/setup-leave-requests.sql` 을 실행해 주세요.</p>
        ) : null
      }
    />
  )
}
