import { MaterialHistoryWorkspace } from '@/components/materials/history/material-history-workspace'
import { PageShell } from '@/components/ui/page-shell'
import { fetchMaterialInboundPageData } from '@/lib/materials/inbound/repository'
import {
  parseMaterialHistoryCategory,
  type MaterialHistoryCategory,
} from '@/lib/materials/history/category'
import { fetchMaterialOutboundPageData } from '@/lib/materials/outbound/repository'
import { fetchMaterialPurchaseOrderHistoryData } from '@/lib/materials/purchase-orders/repository'

type MaterialHistoryPageProps = {
  searchParams?: Promise<{ category?: string | string[] }>
}

export default async function MaterialHistoryPage({ searchParams }: MaterialHistoryPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = Array.isArray(params.category) ? params.category[0] : params.category
  const initialCategory: MaterialHistoryCategory = parseMaterialHistoryCategory(raw)

  const [purchaseResult, inboundResult, outboundResult] = await Promise.all([
    fetchMaterialPurchaseOrderHistoryData(),
    fetchMaterialInboundPageData(),
    fetchMaterialOutboundPageData(),
  ])

  return (
    <PageShell>
      <MaterialHistoryWorkspace
        purchaseResult={purchaseResult}
        inboundResult={inboundResult}
        outboundResult={outboundResult}
        initialCategory={initialCategory}
      />
    </PageShell>
  )
}
