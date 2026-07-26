import type { ModuleTabItem } from '@/components/dashboard/module-tab-shell'

/** 발주: 주문서 부분 발주 / 자재별 합산 (이력은 /materials/history) */
export const MATERIAL_PURCHASE_ORDER_TABS: ModuleTabItem[] = [
  { label: '주문서 발주', href: '/materials/purchase-orders' },
  { label: '자재별 발주', href: '/materials/purchase-orders/by-material' },
]

