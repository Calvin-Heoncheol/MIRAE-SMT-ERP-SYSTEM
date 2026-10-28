import { describe, expect, it } from 'vitest'
import { splitPlanQuantityByWorkday } from '@/lib/production-plan/calendar'

describe('splitPlanQuantityByWorkday', () => {
  it('주말을 건너뛰고 평일에 균등 분배한다', () => {
    // 2026-10-26(월) ~ 2026-11-02(월): 평일 6일
    const result = splitPlanQuantityByWorkday('2026-10-26', '2026-11-02', 5500)
    expect(result.map((day) => day.date)).toEqual([
      '2026-10-26',
      '2026-10-27',
      '2026-10-28',
      '2026-10-29',
      '2026-10-30',
      '2026-11-02',
    ])
    expect(result.map((day) => day.quantity)).toEqual([917, 917, 917, 917, 916, 916])
    expect(result.reduce((sum, day) => sum + day.quantity, 0)).toBe(5500)
  })

  it('종료일이 없으면 시작일 하루', () => {
    expect(splitPlanQuantityByWorkday('2026-10-28', '', 300)).toEqual([
      { date: '2026-10-28', quantity: 300 },
    ])
  })

  it('평일이 없으면 시작일에 전부 둔다', () => {
    expect(splitPlanQuantityByWorkday('2026-10-31', '2026-11-01', 100)).toEqual([
      { date: '2026-10-31', quantity: 100 },
    ])
  })
})
