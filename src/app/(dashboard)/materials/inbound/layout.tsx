import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { MATERIAL_INBOUND_TABS } from '@/lib/materials/inbound/tabs'

export default function MaterialInboundLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell
      title="자재 입고"
      description="기초·발주·사급·반품 입고를 등록하고 이력을 관리합니다."
      tabs={MATERIAL_INBOUND_TABS}
      ariaLabel="자재 입고 탭"
    >
      {children}
    </ModuleTabShell>
  )
}
