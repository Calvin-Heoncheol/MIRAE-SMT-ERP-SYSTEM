import { SolderCreamLogWorkspace } from '@/components/materials/solder-cream/solder-cream-log-workspace'
import { fetchSolderCreamLogPageData } from '@/lib/materials/solder-cream/repository'

export const dynamic = 'force-dynamic'

export default async function SmtSolderPastePage() {
  const result = await fetchSolderCreamLogPageData()
  return <SolderCreamLogWorkspace result={result} />
}
