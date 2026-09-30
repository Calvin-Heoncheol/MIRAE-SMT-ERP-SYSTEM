/** Supabase(PostgREST)는 한 번에 최대 1000행만 돌려주므로 .limit(20000) 도 1000행에서 잘립니다. */
export const SUPABASE_PAGE_SIZE = 1000

type PageResult<T, E> = { data: T[] | null; error: E | null }

/**
 * range 페이지를 끝까지 이어 받아 합칩니다.
 * fetchPage 쿼리에는 정렬(.order)을 꼭 넣어야 페이지 사이 중복·누락이 없습니다.
 */
export async function fetchAllPages<T, E>(
  fetchPage: (from: number, to: number) => PromiseLike<PageResult<T, E>>,
  options: { pageSize?: number; maxRows?: number } = {},
): Promise<{ data: T[]; error: E | null }> {
  const pageSize = options.pageSize ?? SUPABASE_PAGE_SIZE
  const maxRows = options.maxRows ?? 200_000
  const rows: T[] = []

  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await fetchPage(from, from + pageSize - 1)
    if (error) return { data: rows, error }
    const page = data || []
    rows.push(...page)
    if (page.length < pageSize) return { data: rows, error: null }
  }

  console.warn(`[fetchAllPages] ${maxRows}행 상한에 도달해 이후 데이터는 조회되지 않았습니다.`)
  return { data: rows, error: null }
}
