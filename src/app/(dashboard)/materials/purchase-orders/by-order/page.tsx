import { redirect } from 'next/navigation'

/** 주문서별 전용 화면 제거 — 새 자재 발주의 「부분 발주」패널로 통합 */
export default function MaterialPurchaseOrdersByOrderRedirectPage() {
  redirect('/materials/purchase-orders/by-material?mode=partial')
}
