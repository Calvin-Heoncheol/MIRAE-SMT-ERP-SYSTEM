import { describe, expect, it } from 'vitest'
import type { ProductionLot } from './types'
import { allocateLotsFifo } from './utils'

function lot(id: string, lotDate: string, remaining: number) {
  return { id, lotDate, remaining } as ProductionLot
}

describe('allocateLotsFifo', () => {
  const lots = [lot('L3', '2026-09-03', 50), lot('L1', '2026-09-01', 30), lot('L2', '2026-09-02', 0)]

  it('오래된 LOT 부터 차감하고 잔량 0 LOT 는 건너뛴다', () => {
    expect(allocateLotsFifo(lots, 40).map((row) => [row.lotId, row.quantity])).toEqual([
      ['L1', 30],
      ['L3', 10],
    ])
  })

  it('수량이 0 이하면 아무것도 배정하지 않는다', () => {
    expect(allocateLotsFifo(lots, 0)).toEqual([])
    expect(allocateLotsFifo(lots, -5)).toEqual([])
  })

  it('전체 잔량보다 많이 요청하면 가능한 만큼만 배정한다', () => {
    const total = allocateLotsFifo(lots, 1000).reduce((sum, row) => sum + row.quantity, 0)
    expect(total).toBe(80)
  })
})
