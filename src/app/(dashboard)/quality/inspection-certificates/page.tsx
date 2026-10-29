import { InspectionCertificateWorkspace } from '@/components/quality/inspection-certificate-workspace'
import { fetchDeliveryHistory } from '@/lib/delivery/repository'

export const dynamic = 'force-dynamic'

export default async function QualityInspectionCertificatesPage() {
  const result = await fetchDeliveryHistory()
  return <InspectionCertificateWorkspace result={result} />
}
