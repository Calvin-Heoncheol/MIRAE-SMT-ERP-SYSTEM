import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { MATERIAL_PURCHASE_ORDER_TABS } from '@/lib/materials/flow-tabs'

export default function MaterialPurchaseOrdersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell title="자재 발주" tabs={MATERIAL_PURCHASE_ORDER_TABS} ariaLabel="자재 발주 탭">
      {children}
    </ModuleTabShell>
  )
}
