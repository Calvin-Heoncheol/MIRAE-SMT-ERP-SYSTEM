import { redirect } from 'next/navigation'

/** 발주서별 전용 화면 제거 — 새 구매발주의 「부분 구매발주」패널로 통합 */
export default function MaterialPurchaseOrdersByOrderRedirectPage() {
  redirect('/materials/purchase-orders/by-material?mode=partial')
}
