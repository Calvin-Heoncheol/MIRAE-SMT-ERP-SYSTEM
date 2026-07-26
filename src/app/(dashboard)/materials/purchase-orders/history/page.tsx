import { redirect } from 'next/navigation'

export default function MaterialPurchaseOrdersHistoryRedirectPage() {
  redirect('/materials/history?category=purchase')
}
