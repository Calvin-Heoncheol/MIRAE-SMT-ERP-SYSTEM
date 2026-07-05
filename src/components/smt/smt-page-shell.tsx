import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'
import { SMT_TABS } from '@/lib/smt/tabs'

type SmtPageShellProps = {
  children: React.ReactNode
}

export function SmtPageShell({ children }: SmtPageShellProps) {
  return (
    <ModuleTabShell
      title="SMT"
      description="SMT 생산 계획·입력·이력을 관리합니다."
      tabs={SMT_TABS}
      ariaLabel="SMT 탭"
    >
      {children}
    </ModuleTabShell>
  )
}
