import { notFound } from 'next/navigation'
import { ApprovalsWorkspace } from '@/components/approvals/approvals-workspace'
import { isApprovalCategory } from '@/lib/approvals/categories'
import { fetchApprovals } from '@/lib/approvals/repository'

type ApprovalsCategoryPageProps = {
  params: Promise<{ category: string }>
}

export default async function ApprovalsCategoryPage({ params }: ApprovalsCategoryPageProps) {
  const { category } = await params

  if (!isApprovalCategory(category)) {
    notFound()
  }

  const result = await fetchApprovals()
  return <ApprovalsWorkspace category={category} result={result} />
}
