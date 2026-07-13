import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { MATERIAL_PURCHASE_ORDER_TABS } from '@/lib/materials/purchase-orders/tabs'

export default function MaterialPurchaseOrdersLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell
      title="자재 발주"
      description="주문서·BOM·현재고를 비교해 발주가 필요한 자재를 확인하고 이력을 관리합니다."
      tabs={MATERIAL_PURCHASE_ORDER_TABS}
      ariaLabel="자재 발주 탭"
    >
      {children}
    </ModuleTabShell>
  )
}
