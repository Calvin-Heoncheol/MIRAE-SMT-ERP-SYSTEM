import { redirect } from 'next/navigation'

export default function MaterialInboundHistoryRedirectPage() {
  redirect('/materials/history?category=inbound')
}
