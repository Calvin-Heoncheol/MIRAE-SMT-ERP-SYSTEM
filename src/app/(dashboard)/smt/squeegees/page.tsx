import { SqueegeesWorkspace } from '@/components/smt/squeegees-workspace'
import { fetchSqueegeeAssets } from '@/lib/squeegees/repository'

export default async function SmtSqueegeesPage() {
  const result = await fetchSqueegeeAssets()
  return <SqueegeesWorkspace result={result} />
}
