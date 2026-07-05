import { SmtPageShell } from '@/components/smt/smt-page-shell'

export default function SmtLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <SmtPageShell>{children}</SmtPageShell>
}
