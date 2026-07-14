import { MetalMasksWorkspace } from '@/components/smt/metal-masks-workspace'
import { fetchMetalMaskAssets } from '@/lib/metal-masks/repository'

export default async function SmtMetalMasksPage() {
  const result = await fetchMetalMaskAssets()
  return <MetalMasksWorkspace result={result} />
}
