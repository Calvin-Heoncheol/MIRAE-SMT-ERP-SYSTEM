'use client'

type ListPaginationProps = {
  page: number
  totalPages: number
  onPageChange: (page: number) => void
  rangeStart: number
  rangeEnd: number
  totalCount: number
}

export function ListPagination({
  page,
  totalPages,
  onPageChange,
  rangeStart,
  rangeEnd,
  totalCount,
}: ListPaginationProps) {
  if (totalCount === 0) return null

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
      <p className="text-sm text-slate-500">
        <span className="tabular-nums font-medium text-slate-700">
          {rangeStart.toLocaleString('ko-KR')}–{rangeEnd.toLocaleString('ko-KR')}
        </span>
        <span className="text-slate-400"> / {totalCount.toLocaleString('ko-KR')}건</span>
      </p>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          이전
        </button>
        <span className="min-w-[4.5rem] text-center text-sm font-semibold tabular-nums text-slate-700">
          {page} / {totalPages}
        </span>
        <button
          type="button"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          다음
        </button>
      </div>
    </div>
  )
}
