import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { MATERIAL_OUTBOUND_TABS } from '@/lib/materials/outbound/tabs'

export default function MaterialOutboundLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell title="불출" tabs={MATERIAL_OUTBOUND_TABS} ariaLabel="자재 불출 탭">
      {children}
    </ModuleTabShell>
  )
}
