import { EquipmentWorkspace } from '@/components/equipment/equipment-workspace'
import { fetchSmtLinesWithEquipment } from '@/lib/equipment/repository'

export const dynamic = 'force-dynamic'

export default async function MasterEquipmentPage() {
  const result = await fetchSmtLinesWithEquipment()
  return <EquipmentWorkspace result={result} />
}
