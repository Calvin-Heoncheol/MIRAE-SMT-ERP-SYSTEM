import { HomeDashboard } from '@/components/dashboard/home/home-dashboard'
import { getAuthProfile } from '@/lib/auth/session'
import { canPerformDangerousWrite } from '@/lib/auth/write-permissions'
import { fetchHomeDashboardData } from '@/lib/dashboard/home-data'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const [data, profile] = await Promise.all([fetchHomeDashboardData(), getAuthProfile()])
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
