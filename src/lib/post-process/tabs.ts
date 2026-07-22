import type { ModuleTabItem } from '@/components/dashboard/module-tab-shell'

export const POST_PROCESS_TABS: ModuleTabItem[] = [
  { label: '생산계획 (준비중)', href: '/post-process/plan', disabled: true },
  { label: '생산입력', href: '/post-process/input' },
]
