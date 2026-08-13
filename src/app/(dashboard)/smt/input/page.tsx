import { ProductionInputWorkspace } from '@/components/production-input/production-input-workspace'
import { fetchProductionInputPageData } from '@/lib/production-input/repository'
import { SMT_PRODUCTION_INPUT_CONFIG } from '@/lib/smt/config'

export const dynamic = 'force-dynamic'

type SmtInputPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[] }>
}

export default async function SmtInputPage({ searchParams }: SmtInputPageProps) {
  const params = searchParams ? await searchParams : {}
  const raw = params.uiKey
  const initialUiKey = Array.isArray(raw) ? raw[0] || '' : raw || ''

  const result = await fetchProductionInputPageData(SMT_PRODUCTION_INPUT_CONFIG)

  return (
    <ProductionInputWorkspace
      result={result}
      config={SMT_PRODUCTION_INPUT_CONFIG}
      showOrderSidebar
      initialUiKey={initialUiKey}
    />
  )
}
