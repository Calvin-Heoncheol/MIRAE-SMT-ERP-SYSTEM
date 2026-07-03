import { MaterialsListWorkspace } from '@/components/materials/materials-list-workspace'
import { fetchMaterials } from '@/lib/materials/repository'

export default async function MaterialsPage() {
  const result = await fetchMaterials()
  return <MaterialsListWorkspace result={result} />
}
