import { PageShell } from '@/components/ui/page-shell'

export default function PostProcessLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <PageShell>{children}</PageShell>
}
