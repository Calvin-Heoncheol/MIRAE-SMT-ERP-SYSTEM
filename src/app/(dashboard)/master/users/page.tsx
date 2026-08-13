import { UsersWorkspace } from '@/components/users/users-workspace'
import { fetchErpUsers } from '@/lib/users/actions'

export default async function MasterUsersPage() {
  const result = await fetchErpUsers()
  return <UsersWorkspace result={result} />
}
