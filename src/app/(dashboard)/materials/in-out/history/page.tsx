import { MaterialManualHistoryWorkspace } from '@/components/materials/manual/material-manual-history-workspace'
import { fetchMaterialManualHistory } from '@/lib/materials/manual/repository'

export const dynamic = 'force-dynamic'

export default async function MaterialInOutHistoryPage() {
  const result = await fetchMaterialManualHistory()
  return <MaterialManualHistoryWorkspace result={result} />
}
