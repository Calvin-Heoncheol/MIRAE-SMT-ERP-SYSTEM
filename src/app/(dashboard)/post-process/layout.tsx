import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { POST_PROCESS_TABS } from '@/lib/post-process/tabs'

export default function PostProcessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell
      title="후공정"
      tabs={POST_PROCESS_TABS}
      ariaLabel="후공정 탭"
      preserveQueryParams={['team']}
    >
      {children}
    </ModuleTabShell>
  )
}
