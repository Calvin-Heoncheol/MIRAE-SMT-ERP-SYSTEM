import type { ModuleTabItem } from '@/components/dashboard/module-tab-shell'

export const SMT_TABS: ModuleTabItem[] = [
  { label: '생산계획 (준비중)', href: '/smt/plan', disabled: true },
  { label: '생산입력', href: '/smt/input' },
  { label: '생산이력', href: '/smt/history' },
  {
    label: '마스크·스퀴즈',
    href: '/smt/metal-masks',
    align: 'end',
    menu: [
      { label: '메탈마스크', href: '/smt/metal-masks' },
      { label: '스퀴즈', href: '/smt/squeegees' },
    ],
  },
]
