import { DeliveryInputWorkspace } from '@/components/delivery/delivery-input-workspace'
import { fetchDeliveryHistory, fetchDeliveryInputPageData } from '@/lib/delivery/repository'

export const dynamic = 'force-dynamic'

type DeliveryInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[] }>
}

export default async function DeliveryInputPage({ searchParams }: DeliveryInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.uiKey
  const initialUiKey = Array.isArray(raw) ? raw[0] || '' : raw || ''

  const [historyResult, inputResult] = await Promise.all([
    fetchDeliveryHistory(),
    fetchDeliveryInputPageData(),
  ])

  return (
    <DeliveryInputWorkspace
      historyResult={historyResult}
      inputResult={inputResult}
      initialUiKey={initialUiKey}
    />
  )
}
