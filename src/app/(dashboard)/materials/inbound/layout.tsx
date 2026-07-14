import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { MATERIAL_INBOUND_TABS } from '@/lib/materials/inbound/tabs'

export default function MaterialInboundLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell title="자재 입고" tabs={MATERIAL_INBOUND_TABS} ariaLabel="자재 입고 탭">
      {children}
    </ModuleTabShell>
  )
}
