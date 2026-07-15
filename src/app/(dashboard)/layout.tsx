import { TopNav } from '@/components/dashboard/top-nav'

/** Supabase 데이터가 빌드 시점 HTML에 고정되지 않도록 매 요청마다 조회합니다. */
export const dynamic = 'force-dynamic'

export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="flex min-h-screen flex-col text-slate-900">
      <TopNav />
      <main className="flex min-h-0 w-full flex-1 flex-col px-5 py-5 lg:px-8">{children}</main>
    </div>
  )
}
