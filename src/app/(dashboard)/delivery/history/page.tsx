import { redirect } from 'next/navigation'

/** 출하이력은 출하 및 거래명세서 화면으로 통합됨 */
export default function DeliveryHistoryPage() {
  redirect('/delivery/input')
}
