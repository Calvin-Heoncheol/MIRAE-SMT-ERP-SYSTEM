import type { ModuleTabItem } from '@/components/dashboard/module-tab-shell'

/** 발주: 주문서 카드 → 발주 모달 */
export const MATERIAL_PURCHASE_ORDER_TABS: ModuleTabItem[] = [
  { label: '발주등록', href: '/materials/purchase-orders' },
  { label: '발주이력', href: '/materials/purchase-orders/history' },
]

/** 입고: 발주서 카드 → 입고 모달 */
export const MATERIAL_INBOUND_TABS: ModuleTabItem[] = [
  { label: '입고등록', href: '/materials/inbound' },
  { label: '입고이력', href: '/materials/inbound/history' },
]

/** 불출: 주문서(미불출) 카드 → 불출 등록 */
export const MATERIAL_OUTBOUND_TABS: ModuleTabItem[] = [
  { label: '불출등록', href: '/materials/outbound' },
  { label: '불출이력', href: '/materials/outbound/history' },
]
