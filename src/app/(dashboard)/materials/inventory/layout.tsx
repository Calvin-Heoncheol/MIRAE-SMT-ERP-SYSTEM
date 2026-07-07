import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { MATERIAL_INVENTORY_TABS } from '@/lib/materials/inventory/tabs'

export default function MaterialInventoryLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell
      title="재고현황"
      description="재고 조회와 입고·불출 처리를 관리합니다."
      tabs={MATERIAL_INVENTORY_TABS}
      ariaLabel="재고현황 탭"
    >
      {children}
    </ModuleTabShell>
  )
}
