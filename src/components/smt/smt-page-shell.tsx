import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'

type SmtPageShellProps = {
  children: React.ReactNode
}

/** 상단 탭은 일시적으로 비표시 (탭 정의는 lib/smt/tabs.ts에 유지) */
export function SmtPageShell({ children }: SmtPageShellProps) {
  return (
    <ModuleTabShell title="SMT" tabs={[]} ariaLabel="SMT 탭">
      {children}
    </ModuleTabShell>
  )
}
