import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { DELIVERY_TABS } from '@/lib/delivery/tabs'

export default function DeliveryLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell
      title="출하"
      description="출하 계획·입력·이력을 관리합니다."
      tabs={DELIVERY_TABS}
      ariaLabel="출하 탭"
    >
      {children}
    </ModuleTabShell>
  )
}
