import { ShipmentStatusWorkspace } from '@/components/delivery/shipment-status-workspace'
import { fetchShipmentStatusRows } from '@/lib/delivery/shipment-status-repository'

export const dynamic = 'force-dynamic'

export default async function DeliveryStatusPage() {
  const result = await fetchShipmentStatusRows()
  return <ShipmentStatusWorkspace result={result} />
}
