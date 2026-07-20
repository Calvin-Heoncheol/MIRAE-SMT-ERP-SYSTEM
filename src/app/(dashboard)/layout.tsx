import { SideNav } from '@/components/dashboard/side-nav'

/** Supabase 데이터가 빌드 시점 HTML에 고정되지 않도록 매 요청마다 조회합니다. */
export const dynamic = 'force-dynamic'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-dvh flex-col text-slate-900 lg:flex-row">
      <SideNav />
      <main className="flex min-h-0 min-w-0 w-full flex-1 flex-col px-4 py-4 lg:px-6 lg:py-5">
        {children}
      </main>
    </div>
  )
}
