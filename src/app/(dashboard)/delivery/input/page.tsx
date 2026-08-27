import { DeliveryInputWorkspace } from '@/components/delivery/delivery-input-workspace'
import { fetchDeliveryHistory, fetchDeliveryInputPageData } from '@/lib/delivery/repository'
import { fetchLegacyStatementGroups } from '@/lib/reports/sales-report'

export const dynamic = 'force-dynamic'

type DeliveryInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[] }>
}

export default async function DeliveryInputPage({ searchParams }: DeliveryInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.uiKey
  const initialUiKey = Array.isArray(raw) ? raw[0] || '' : raw || ''

  const [historyResult, inputResult, legacyResult] = await Promise.all([
    fetchDeliveryHistory(),
    fetchDeliveryInputPageData(),
    fetchLegacyStatementGroups(),
  ])

  return (
    <DeliveryInputWorkspace
      historyResult={historyResult}
      inputResult={inputResult}
      legacyGroupsResult={legacyResult}
      initialUiKey={initialUiKey}
    />
  )
}
