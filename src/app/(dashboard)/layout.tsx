import { TopNav } from '@/components/dashboard/top-nav'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen flex-col text-slate-900">
      <TopNav />
      <main className="w-full flex-1 px-5 py-5 lg:px-8">{children}</main>
    </div>
  )
}
