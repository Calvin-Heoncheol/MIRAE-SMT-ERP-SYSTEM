import type { OrderCurrency } from './types'
import { isBillingOnlyOrderItem, computeOrderLineAmortizedUnitPrice, computeOrderLineMaterialCost } from './utils'
import type { Product } from '@/lib/products/types'
import { findProductsByCode } from '@/lib/products/utils'

let orderItemRowKeyCounter = 0

export function createOrderItemRowKey() {
  orderItemRowKeyCounter += 1
  return `order-item-${Date.now()}-${orderItemRowKeyCounter}`
}

export type OrderItemForm = {
  /** React key·행 연결용 (저장하지 않음) */
  rowKey: string
  /** DB order_lines.id — 수정 시 라인 유지용 (신규 행은 빈 문자열) */
  lineId?: string
  productId: string
  productCode: string
  productName: string
  quantity: string | number
  /** 단가 = SET-UP÷수량 + SMD + 후공정 + 자재(대당) */
  unitPrice: string | number
  setupCost: string | number
  smdUnitPrice: string | number
  dipUnitPrice: string | number
  /** 자재 대당 단가 (품목 마스터) */
  materialUnitPrice: string | number
  /** 자재비 총액 = 수량 × materialUnitPrice */
  materialCost: string | number
  /** 제품(라인)별 납기일 YYYY-MM-DD */
  deliveryDate: string
  /** 작업번호 — 저장 후 표시 (신규 행은 빈 문자열) */
  workNumber?: string
  /** 추가 작업(금액 전용) — 품목등록 필수, 저장 시 product_id 는 비움 */
  isAdhoc?: boolean
  /** 품목 추가비용 자동 행 — 부모 제품 행 rowKey */
  companionOfRowKey?: string
  /** 단가 출처 견적 (UI용, 저장하지 않음) */
  quoteId?: string
}

export type OrderFormState = {
  orderCode: string
  orderDate: string
  /** 공통 납기일 — 제품 행에 일괄 반영용 */
  deliveryDate: string
  customer: string
  category: '양산' | '샘플' | '자재'
  /** 표시 통화 — 기본 KRW */
  currency: OrderCurrency
  note: string
  /** 발주번호(고객 PO/NO) */
  customerPoNumber: string
}

export function defaultOrderItemForm(deliveryDate = ''): OrderItemForm {
  return {
    rowKey: createOrderItemRowKey(),
    lineId: '',
    productId: '',
    productCode: '',
    productName: '',
    quantity: '0',
    unitPrice: '0',
    setupCost: '0',
    smdUnitPrice: '0',
    dipUnitPrice: '0',
    materialUnitPrice: '0',
    materialCost: '0',
    deliveryDate,
    isAdhoc: false,
    quoteId: '',
  }
}

export function defaultAdhocOrderItemForm(deliveryDate = ''): OrderItemForm {
  return {
    rowKey: createOrderItemRowKey(),
    lineId: '',
    productId: '',
    productCode: '',
    productName: '',
    quantity: '1',
    unitPrice: '0',
    setupCost: '0',
    smdUnitPrice: '0',
    dipUnitPrice: '0',
    materialUnitPrice: '0',
    materialCost: '0',
    deliveryDate,
    isAdhoc: true,
    quoteId: '',
  }
}

export function orderItemsFromDetail(
  items: {
    lineId?: string
    productId?: string | null
    productCode: string
    productName: string
    quantity: number
    unitPrice: number
    setupCost?: number
    smdUnitPrice?: number
    dipUnitPrice?: number
    materialCost?: number
    deliveryDate?: string
    workNumber?: string | null
  }[],
  fallbackDeliveryDate = '',
  options?: { quoteId?: string },
) {
  if (!items.length) return [defaultOrderItemForm(fallbackDeliveryDate)]
  return items.map((item) => {
    const smd = Math.max(0, Math.round(Number(item.smdUnitPrice) || 0))
    const dip = Math.max(0, Math.round(Number(item.dipUnitPrice) || 0))
    const setupCost = Math.max(0, Math.round(Number(item.setupCost) || 0))
    const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
    const materialCost = Math.max(0, Math.round(Number(item.materialCost) || 0))
    const materialUnitPrice =
      quantity > 0 && materialCost > 0 ? Math.round(materialCost / quantity) : 0
    const unit =
      smd + dip > 0 || setupCost > 0 || materialUnitPrice > 0
        ? computeOrderLineAmortizedUnitPrice({
            quantity,
            setupCost,
            smdUnitPrice: smd,
            dipUnitPrice: dip,
            materialUnitPrice,
          })
        : Math.max(0, Math.round(Number(item.unitPrice) || 0))
    return {
      rowKey: createOrderItemRowKey(),
      lineId: String(item.lineId || '').trim(),
      productId: item.productId || '',
      productCode: item.productCode || '',
      productName: item.productName || '',
      quantity: String(item.quantity || 0),
      unitPrice: String(unit),
      setupCost: String(setupCost),
      smdUnitPrice: String(smd || unit),
      dipUnitPrice: String(dip),
      materialUnitPrice: String(materialUnitPrice),
      materialCost: String(materialCost),
      deliveryDate: String(item.deliveryDate || fallbackDeliveryDate || '').trim(),
      workNumber: String(item.workNumber || '').trim(),
      isAdhoc: isBillingOnlyOrderItem(item),
      quoteId: options?.quoteId || '',
    }
  })
}

/** 수정 모달 — 저장된 추가작업 행에 companion 연결·버전 표시용 productId 복원 */
export function hydrateOrderItemsFromDetail(
  items: OrderItemForm[],
  products: Product[],
  customer: string,
): OrderItemForm[] {
  const customerName = customer.trim()
  return items.map((item, index) => {
    if (!item.isAdhoc) return item

    const prev = index > 0 ? items[index - 1] : null
    const followsProduct =
      prev &&
      !prev.isAdhoc &&
      prev.productCode.trim() &&
      prev.productCode.trim() === item.productCode.trim() &&
      (!item.productName.trim() || item.productName.trim() === prev.productName.trim())

    let productId = item.productId.trim()
    if (!productId && followsProduct && prev.productId.trim()) {
      productId = prev.productId.trim()
    }
    if (!productId && item.productCode.trim()) {
      const matches = findProductsByCode(products, item.productCode, customerName)
      const narrowed = item.productName.trim()
        ? matches.filter((product) => product.productName === item.productName.trim())
        : matches
      if (narrowed.length === 1) productId = narrowed[0]!.id
    }

    return {
      ...item,
      ...(followsProduct ? { companionOfRowKey: prev!.rowKey } : {}),
      ...(productId ? { productId } : {}),
    }
  })
}
