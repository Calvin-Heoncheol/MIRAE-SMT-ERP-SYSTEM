import { MaterialManualWorkspace } from '@/components/materials/manual/material-manual-workspace'
import { PageShell } from '@/components/ui/page-shell'
import { fetchMaterialManualPageData } from '@/lib/materials/manual/repository'

export const dynamic = 'force-dynamic'

type MaterialInOutPageProps = {
  searchParams?: Promise<{ uiKey?: string | string[] }>
}

export default async function MaterialInOutPage({ searchParams }: MaterialInOutPageProps) {
  const params = searchParams ? await searchParams : {}
  const rawUiKey = params.uiKey
  const initialUiKey = Array.isArray(rawUiKey) ? rawUiKey[0] || '' : rawUiKey || ''
  const result = await fetchMaterialManualPageData()

  return (
    <PageShell>
      <MaterialManualWorkspace initialResult={result} initialUiKey={initialUiKey} />
    </PageShell>
  )
}
