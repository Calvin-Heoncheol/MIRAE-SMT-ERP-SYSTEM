import { redirect } from 'next/navigation'

export default function MaterialOutboundHistoryRedirectPage() {
  redirect('/materials/history?category=outbound')
}
