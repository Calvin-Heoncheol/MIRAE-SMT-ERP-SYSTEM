import { HomeDashboard } from '@/components/dashboard/home/home-dashboard'
import { getAuthProfile } from '@/lib/auth/session'
import { canPerformDangerousWrite } from '@/lib/auth/write-permissions'
import { fetchHomeDashboardData } from '@/lib/dashboard/home-data'

export const dynamic = 'force-dynamic'

type DashboardPageProps = {
  searchParams?: Promise<{ period?: string | string[]; date?: string | string[] }>
}

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
  const params = searchParams ? await searchParams : {}
  const [data, profile] = await Promise.all([
    fetchHomeDashboardData({ period: params.period, date: params.date }),
    getAuthProfile(),
  ])
  const canManageNotices = profile ? canPerformDangerousWrite(profile.role) : false
  return (
    <HomeDashboard
      data={{
        ...data,
        canManageNotices,
      }}
    />
  )
}
