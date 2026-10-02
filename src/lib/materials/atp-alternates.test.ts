import { describe, expect, it } from 'vitest'
import { allocateSoftReservations, buildAtpLinesFromAllocations } from '@/lib/materials/atp'

function nested(entries: Array<[string, string, number]>) {
  const map = new Map<string, Map<string, number>>()
  for (const [orderId, materialId, value] of entries) {
    const byMaterial = map.get(orderId) || new Map<string, number>()
    byMaterial.set(materialId, value)
    map.set(orderId, byMaterial)
  }
  return map
}

const alternates = new Map([['O1', new Map([['A', ['B']]])]])

describe('BOM 대체 ATP', () => {
  it('주자재 부족분을 대체 재고로 예약하고 구매 부족을 줄인다', () => {
    const allocations = allocateSoftReservations({
      requiredByOrderMaterial: nested([['O1', 'A', 100]]),
      onHandByMaterialId: new Map([
        ['A', 60],
        ['B', 30],
      ]),
      orderPriority: [{ orderId: 'O1' }],
      alternatesByOrderMaterial: alternates,
    })
    const lines = buildAtpLinesFromAllocations({ allocations })
    const a = lines.find((line) => line.materialId === 'A')!
    const b = lines.find((line) => line.materialId === 'B')!
    expect(a.reservedQty).toBe(60)
    expect(a.shortageQty).toBe(10)
    expect(b.reservedQty).toBe(30)
    expect(b.availableQty).toBe(30)
    expect(b.shortageQty).toBe(0)
  })

  it('대체 품목의 자체 소요가 먼저 예약된다', () => {
    const allocations = allocateSoftReservations({
      requiredByOrderMaterial: nested([
        ['O1', 'A', 100],
        ['O2', 'B', 20],
      ]),
      onHandByMaterialId: new Map([
        ['A', 60],
        ['B', 30],
      ]),
      orderPriority: [{ orderId: 'O1' }, { orderId: 'O2' }],
      alternatesByOrderMaterial: alternates,
    })
    const lines = buildAtpLinesFromAllocations({ allocations })
    const o2b = lines.find((line) => line.orderId === 'O2' && line.materialId === 'B')!
    const o1b = lines.find((line) => line.orderId === 'O1' && line.materialId === 'B')!
    const o1a = lines.find((line) => line.orderId === 'O1' && line.materialId === 'A')!
    expect(o2b.reservedQty).toBe(20)
    expect(o1b.reservedQty).toBe(10)
    expect(o1a.shortageQty).toBe(30)
  })

  it('이미 불출한 대체 수량은 주자재 불출로 인정된다', () => {
    const allocations = allocateSoftReservations({
      requiredByOrderMaterial: nested([['O1', 'A', 100]]),
      issuedByOrderMaterial: nested([['O1', 'B', 40]]),
      onHandByMaterialId: new Map([['A', 60]]),
      orderPriority: [{ orderId: 'O1' }],
      alternatesByOrderMaterial: alternates,
    })
    const lines = buildAtpLinesFromAllocations({ allocations })
    const a = lines.find((line) => line.materialId === 'A')!
    const b = lines.find((line) => line.materialId === 'B')!
    expect(a.shortageQty).toBe(0)
    expect(a.availableQty).toBe(60)
    expect(b.remainingNeed).toBe(0)
  })

  it('대체가 없으면 기존과 같다', () => {
    const allocations = allocateSoftReservations({
      requiredByOrderMaterial: nested([['O1', 'A', 100]]),
      onHandByMaterialId: new Map([
        ['A', 60],
        ['B', 30],
      ]),
      orderPriority: [{ orderId: 'O1' }],
    })
    expect(allocations).toHaveLength(1)
    expect(buildAtpLinesFromAllocations({ allocations })[0]!.shortageQty).toBe(40)
  })
})
