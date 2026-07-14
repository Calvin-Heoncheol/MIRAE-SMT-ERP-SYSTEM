import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { SMT_TABS } from '@/lib/smt/tabs'

type SmtPageShellProps = {
  children: React.ReactNode
}

export function SmtPageShell({ children }: SmtPageShellProps) {
  return (
    <ModuleTabShell title="SMT" tabs={SMT_TABS} ariaLabel="SMT 탭">
      {children}
    </ModuleTabShell>
  )
}
