'use client'

import type { FetchApprovalsResult } from '@/lib/approvals/repository'

export function ApprovalFetchError({ result }: { result: Extract<FetchApprovalsResult, { ok: false }> }) {
  return (
    <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8">
      <h2 className="text-lg font-bold text-red-800">품의서 목록을 불러오지 못했습니다</h2>
      <p className="mt-2 text-sm text-red-700">
        {result.reason === 'env'
          ? 'Supabase 환경 변수를 확인해 주세요.'
          : '데이터베이스 조회 중 오류가 발생했습니다.'}
      </p>
      <p className="mt-2 text-xs text-red-600">{result.detail}</p>
      {result.reason === 'query' ? (
        <div className="mt-3 space-y-1 text-xs text-red-600">
          <p>Supabase SQL Editor에서 아래 순서로 실행해 주세요.</p>
          <p>1. `supabase/setup-approvals.sql`</p>
          <p>2. `supabase/setup-approvals-storage.sql` (첨부파일용)</p>
          <p>3. 이미 테이블이 있다면 `supabase/migrate-approvals-doc-number-by-dept.sql`</p>
        </div>
      ) : null}
    </div>
  )
}
