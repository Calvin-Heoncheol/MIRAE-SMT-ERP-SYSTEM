import { MaterialPurchaseOrdersWorkspace } from '@/components/materials/purchase-orders/material-purchase-orders-workspace'
import { fetchMaterialPurchaseOrderRegisterData } from '@/lib/materials/purchase-orders/repository'

type PageProps = {
  searchParams?: Promise<{ mode?: string | string[] }>
}

function firstParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0] || ''
  return value || ''
}

export default async function MaterialPurchaseOrdersByMaterialPage({ searchParams }: PageProps) {
  const params = searchParams ? await searchParams : {}
  const mode = firstParam(params.mode)
  const result = await fetchMaterialPurchaseOrderRegisterData()
  // MTO: 기본은 발주서(부분) 구매. mode=suggestion 일 때만 자재별 제안
  const initialPanel =
    mode === 'suggestion' ? 'suggestion' : mode === 'partial' || !mode ? 'partial' : 'partial'
  return (
    <MaterialPurchaseOrdersWorkspace
      result={result}
      initialPanel={initialPanel}
    />
  )
}
