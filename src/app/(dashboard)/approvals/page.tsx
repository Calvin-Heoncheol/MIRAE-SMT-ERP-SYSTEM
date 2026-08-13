import { redirect } from 'next/navigation'
import { DEFAULT_APPROVAL_CATEGORY } from '@/lib/approvals/categories'

export default function ApprovalsIndexPage() {
  redirect(`/approvals/${DEFAULT_APPROVAL_CATEGORY}`)
}
