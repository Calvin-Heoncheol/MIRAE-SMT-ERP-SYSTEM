import { ModuleTabShell } from '@/components/dashboard/module-tab-shell'

/** 상단 탭은 일시적으로 비표시 (탭 정의는 lib/post-process/tabs.ts에 유지) */
export default function PostProcessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <ModuleTabShell title="후공정" tabs={[]} ariaLabel="후공정 탭" preserveQueryParams={['team']}>
      {children}
    </ModuleTabShell>
  )
}
