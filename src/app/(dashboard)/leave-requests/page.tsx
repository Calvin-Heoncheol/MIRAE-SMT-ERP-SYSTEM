import { LeaveRequestsWorkspace } from '@/components/leave-requests/leave-requests-workspace'
import { fetchLeaveRequests } from '@/lib/leave-requests/repository'

export default async function LeaveRequestsPage() {
  const result = await fetchLeaveRequests()
  return <LeaveRequestsWorkspace result={result} />
}
