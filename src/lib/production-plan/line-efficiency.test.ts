import { describe, expect, it } from 'vitest'
import { buildSmtPlanProgressKey } from '@/lib/smt/count-keys'
import {
  computeBomSmdPoints,
  quoteBoardPlacementPoints,
  smtLineDayKey,
  splitPointsBySide,
  summarizeSmtLineDayEfficiency,
} from './line-efficiency'

describe('computeBomSmdPoints', () => {
  it('SMD 공정 줄과 공정 미지정·SMD 자재 줄만 합산하고 DIP은 제외한다', () => {
    const materialTypeById = new Map([
      ['r1', 'SMD'],
      ['pcb', ''],
      ['con', 'DIP'],
    ])
    const points = computeBomSmdPoints(
      [
        { childProductId: 'c1', quantityPer: 10, process: 'smd' },
        { childProductId: 'r1', quantityPer: 5, process: '' },
        { childProductId: 'pcb', quantityPer: 1, process: '' },
        { childProductId: 'con', quantityPer: 2, process: '' },
        { childProductId: 'x', quantityPer: 3, process: 'dip' },
      ],
      materialTypeById,
    )
    expect(points).toBe(15)
  })
})

describe('quoteBoardPlacementPoints', () => {
  it('IC 핀·BGA 볼은 제외한다', () => {
    expect(quoteBoardPlacementPoints({ chip: 100, smtOdd: 5, smtSpecial: 2 })).toBe(107)
  })
})

describe('splitPointsBySide', () => {
  it('양면은 종수 비율로 나누고, 종수가 없으면 반반', () => {
    expect(
      splitPointsBySide(100, true, {
        arrayCount: 1,
        partCount: 0,
        partCountTop: 30,
        partCountBot: 10,
        tactTimeSec: 0,
        tactTimeTopSec: 0,
        tactTimeBotSec: 0,
      }),
    ).toEqual({ pointsTop: 75, pointsBot: 25 })
    expect(splitPointsBySide(101, true, null)).toEqual({ pointsTop: 51, pointsBot: 50 })
    expect(splitPointsBySide(80, false, null)).toEqual({ pointsTop: 80, pointsBot: 0 })
  })
})

describe('summarizeSmtLineDayEfficiency', () => {
  it('라인·일자별 실적 점수와 사양 CPH 대비 효율을 계산한다', () => {
    const ymd = '2026-10-06'
    const progress = {
      [buildSmtPlanProgressKey('L1', 'SINGLE', 1, ymd)]: 1000,
      [buildSmtPlanProgressKey('L2', 'TOP', 1, ymd)]: 200,
      [buildSmtPlanProgressKey('L3', 'SINGLE', 1, ymd)]: 50,
    }
    const result = summarizeSmtLineDayEfficiency({
      progress,
      pointsByOrderLine: {
        L1: { pointsPerUnit: 100, pointsTop: 100, pointsBot: 0, source: 'bom' },
        L2: { pointsPerUnit: 300, pointsTop: 200, pointsBot: 100, source: 'quote' },
      },
      capacities: [{ lineNo: 1, name: '', ratedCph: 60000, mounterCount: 3 }],
      dayHours: 8,
    })
    const entry = result.get(smtLineDayKey(1, ymd))
    expect(entry?.points).toBe(1000 * 100 + 200 * 200)
    expect(entry?.capacityPoints).toBe(480000)
    expect(entry?.percent).toBe(29)
    expect(entry?.missingPointsQty).toBe(50)
    expect(entry?.sources.sort()).toEqual(['bom', 'quote'])
  })

  it('사양 CPH가 없으면 효율은 null', () => {
    const ymd = '2026-10-06'
    const result = summarizeSmtLineDayEfficiency({
      progress: { [buildSmtPlanProgressKey('L1', 'SINGLE', 2, ymd)]: 10 },
      pointsByOrderLine: {
        L1: { pointsPerUnit: 100, pointsTop: 100, pointsBot: 0, source: 'bom' },
      },
      capacities: [],
      dayHours: 8,
    })
    expect(result.get(smtLineDayKey(2, ymd))?.percent).toBeNull()
  })
})
