import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** 발주현황은 생산현황으로 통합 */
export default function OrdersProgressPage() {
  redirect('/production/status')
}
