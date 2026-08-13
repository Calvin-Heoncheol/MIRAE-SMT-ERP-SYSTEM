import { HomeDashboard } from '@/components/dashboard/home/home-dashboard'
import { fetchHomeDashboardData } from '@/lib/dashboard/home-data'

export const dynamic = 'force-dynamic'

export default async function DashboardPage() {
  const data = await fetchHomeDashboardData()
  return <HomeDashboard data={data} />
}
