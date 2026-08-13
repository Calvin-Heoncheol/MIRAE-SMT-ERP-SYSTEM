import { DefectHandlingWorkspace } from '@/components/quality/defect-handling-workspace'
import { fetchDefectHandlings } from '@/lib/quality/defects/repository'

export default async function QualityDefectsPage() {
  const result = await fetchDefectHandlings()
  return <DefectHandlingWorkspace result={result} />
}
