import type { DeliveryAvailability } from '@/lib/delivery/utils'
import type { ProductionCounts, ProductionOrderLine } from '@/lib/production-input/types'

export type ProductionStatusStage = 'smt' | 'post_process' | 'delivery'

export type ProductionStatusLine = {
  orderId: string
  orderNumber: string
  customer: string
  productName: string
  deliveryDate: string
  /** 주문서 주문수량 합계 */
  quantity: number
  smtTarget: number
  smtProduced: number
  smtPercent: number
  postTarget: number
  postProduced: number
  postPercent: number
  deliveryTarget: number
  deliveryProduced: number
  deliveryPercent: number
}

export type ProductionStatusPageData = {
  lines: ProductionStatusLine[]
  /** 계획 없이 바로 입력용 */
  smtOrders: ProductionOrderLine[]
  postOrders: ProductionOrderLine[]
  deliveryOrders: ProductionOrderLine[]
  smtCounts: ProductionCounts
  postCounts: ProductionCounts
  deliveryCounts: ProductionCounts
  deliveryAvailabilityByGroupId: Record<string, DeliveryAvailability>
}
