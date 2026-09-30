import { describe, expect, it } from 'vitest'
import { fetchAllPages } from './fetch-all-pages'

function fakeTable(total: number) {
  const rows = Array.from({ length: total }, (_, index) => ({ id: index }))
  const calls: Array<[number, number]> = []
  const fetchPage = async (from: number, to: number) => {
    calls.push([from, to])
    return { data: rows.slice(from, to + 1), error: null }
  }
  return { fetchPage, calls }
}

describe('fetchAllPages', () => {
  it('페이지 크기를 넘는 행도 끝까지 모은다', async () => {
    const { fetchPage, calls } = fakeTable(2500)
    const result = await fetchAllPages(fetchPage, { pageSize: 1000 })
    expect(result.error).toBeNull()
    expect(result.data).toHaveLength(2500)
    expect(calls).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('딱 맞아떨어지면 빈 페이지까지 확인하고 끝낸다', async () => {
    const { fetchPage, calls } = fakeTable(2000)
    const result = await fetchAllPages(fetchPage, { pageSize: 1000 })
    expect(result.data).toHaveLength(2000)
    expect(calls).toHaveLength(3)
  })

  it('오류가 나면 그때까지 받은 행과 오류를 돌려준다', async () => {
    let call = 0
    const result = await fetchAllPages(
      async () => {
        call += 1
        if (call === 2) return { data: null, error: { message: 'boom' } }
        return { data: Array.from({ length: 10 }, (_, id) => ({ id })), error: null }
      },
      { pageSize: 10 },
    )
    expect(result.error).toEqual({ message: 'boom' })
    expect(result.data).toHaveLength(10)
  })
})
