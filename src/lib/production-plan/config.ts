import type { ProductionPlanScope } from '@/lib/production-plan/types'

export const SHARED_PRODUCTION_PLAN_DRAG_MIME = 'application/x-mirae-shared-production-plan'

export type ProductionPlanDragPayload = {
  kind: 'order'
  key: string
  scope: ProductionPlanScope
}

export function parseProductionPlanDragPayload(raw: string): ProductionPlanDragPayload | null {
  if (!raw) return null
  try {
    const payload = JSON.parse(raw) as ProductionPlanDragPayload
    if (payload.kind !== 'order' || !payload.key?.trim()) return null
    return payload
  } catch {
    return null
  }
}
