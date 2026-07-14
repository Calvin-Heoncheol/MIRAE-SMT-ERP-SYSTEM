import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { MATERIAL_OUTBOUND_TABS } from '@/lib/materials/outbound/tabs'

export default function MaterialOutboundLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell title="자재 출고" tabs={MATERIAL_OUTBOUND_TABS} ariaLabel="자재 출고 탭">
      {children}
    </ModuleTabShell>
  )
}
