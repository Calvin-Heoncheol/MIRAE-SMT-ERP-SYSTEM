import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { MATERIAL_OUTBOUND_TABS } from '@/lib/materials/outbound/tabs'

export default function MaterialOutboundLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell
      title="자재 출고"
      description="미불출 주문을 확인하고 생산·폐기·조정 출고를 등록합니다."
      tabs={MATERIAL_OUTBOUND_TABS}
      ariaLabel="자재 출고 탭"
    >
      {children}
    </ModuleTabShell>
  )
}
