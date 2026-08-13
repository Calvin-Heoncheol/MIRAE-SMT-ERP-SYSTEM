import type { LotAllocation, ProductionLot } from './types'

export function isMissingProductionLotsTable(detail: string) {
  return (
    detail.includes('production_lots') ||
    detail.includes('delivery_record_lots') ||
    detail.includes('schema cache')
  )
}

export function allocateLotsFifo(lots: ProductionLot[], quantity: number): LotAllocation[] {
  const target = Math.max(0, Math.floor(Number(quantity) || 0))
  if (target < 1) return []

  const sorted = [...lots].sort((a, b) => {
    const byDate = a.lotDate.localeCompare(b.lotDate)
    if (byDate !== 0) return byDate
    return a.id.localeCompare(b.id)
  })

  const allocated: LotAllocation[] = []
  let remaining = target
  for (const lot of sorted) {
    const take = Math.min(Math.max(0, lot.remaining), remaining)
    if (take < 1) continue
    allocated.push({
      lotId: lot.id,
      lotDate: lot.lotDate,
      quantity: take,
      remaining: lot.remaining,
    })
    remaining -= take
    if (remaining <= 0) break
  }
  return allocated
}

export function sumLotAllocationQuantity(allocations: LotAllocation[]) {
  return allocations.reduce((sum, line) => sum + Math.max(0, Math.floor(Number(line.quantity) || 0)), 0)
}

export function formatLotIdsLabel(lotIds: string[]) {
  return [...new Set(lotIds.map((id) => String(id || '').trim()).filter(Boolean))].join(' · ')
}

export function formatLotAllocationLabel(allocations: LotAllocation[]) {
  return formatLotIdsLabel(
    allocations
      .filter((line) => Math.max(0, Math.floor(Number(line.quantity) || 0)) > 0)
      .map((line) => line.lotId),
  )
}
