import { PartnersWorkspace } from '@/components/partners/partners-workspace'
import { fetchBusinessPartners } from '@/lib/partners/repository'

export default async function MasterCustomersPage() {
  const result = await fetchBusinessPartners()
  return <PartnersWorkspace result={result} />
}
