import { PageShell } from '@/components/ui/page-shell'

export default function MaterialOutboundLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PageShell>{children}</PageShell>
}
