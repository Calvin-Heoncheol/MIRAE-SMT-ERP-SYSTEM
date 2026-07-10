import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { POST_PROCESS_TABS } from '@/lib/post-process/tabs'

export default function PostProcessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell
      title="후공정"
      description="후공정 생산 입력·이력을 관리합니다."
      tabs={POST_PROCESS_TABS}
      ariaLabel="후공정 탭"
    >
      {children}
    </ModuleTabShell>
  )
}
