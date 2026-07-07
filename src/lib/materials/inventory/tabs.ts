import type { ModuleTabItem } from '@/components/dashboard/module-tab-shell'

export const MATERIAL_INVENTORY_TABS: ModuleTabItem[] = [
  { label: '현황', href: '/materials/inventory' },
  { label: '입고', href: '/materials/inventory/inbound' },
  { label: '불출', href: '/materials/inventory/outbound' },
]
