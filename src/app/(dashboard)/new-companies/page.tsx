import { NewCompaniesWorkspace } from '@/components/new-companies/new-companies-workspace'
import { fetchNewCompanyInquiries } from '@/lib/new-companies/repository'

export default async function NewCompaniesPage() {
  const result = await fetchNewCompanyInquiries()
  return <NewCompaniesWorkspace result={result} />
}
