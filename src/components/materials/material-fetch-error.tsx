import { isMissingMaterialsTable, type FetchMaterialsResult } from '@/lib/materials/repository'

export function MaterialFetchError({ result }: { result: Extract<FetchMaterialsResult, { ok: false }> }) {
  const missingTable = isMissingMaterialsTable(result.detail)

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
      <p className="font-semibold">
        {result.reason === 'env' ? '환경변수 필요' : '자재 목록을 불러오지 못했습니다'}
      </p>
      <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
      {missingTable ? (
        <p className="mt-3 text-xs text-amber-800">
          Supabase SQL Editor에서{' '}
          <code className="rounded bg-white/70 px-1">supabase/setup-materials.sql</code>
          {result.detail.includes('material_mpns') ? (
            <>
              {' '}
              또는 기존 DB라면 <code className="rounded bg-white/70 px-1">supabase/migrate-material-mpns.sql</code>
            </>
          ) : null}{' '}
          을 실행해 주세요.
        </p>
      ) : null}
    </div>
  )
}
