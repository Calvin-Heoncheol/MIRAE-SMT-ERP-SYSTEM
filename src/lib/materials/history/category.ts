export const MATERIAL_HISTORY_CATEGORIES = ['all', 'purchase', 'inbound', 'outbound'] as const

export type MaterialHistoryCategory = (typeof MATERIAL_HISTORY_CATEGORIES)[number]

export function parseMaterialHistoryCategory(
  value: string | null | undefined,
): MaterialHistoryCategory {
  if (value === 'purchase' || value === 'inbound' || value === 'outbound' || value === 'all') {
    return value
  }
  return 'all'
}

export function materialHistoryCategoryHref(category: MaterialHistoryCategory) {
  if (category === 'all') return '/materials/history'
  return `/materials/history?category=${category}`
}
