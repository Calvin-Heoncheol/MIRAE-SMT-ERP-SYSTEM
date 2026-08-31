import type { OrderItemForm } from './form-state'
import {
  findProductsByCode,
  findProductsByName,
  resolveOrderLineProduct,
  uniqueProductNames,
} from '@/lib/products/utils'
import type { Product } from '@/lib/products/types'
import { computeLineAmount, computeOrderLineBreakdownAmount, computeOrderLineAmortizedUnitPrice, computeOrderLineMaterialCost, isBillingOnlyOrderItem, orderLinePerUnitPrice } from './utils'

export function orderItemFormToModel(item: OrderItemForm) {
  const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
  const setupCost = Math.max(0, Math.round(Number(item.setupCost) || 0))
  const smdUnitPrice = Math.max(0, Math.round(Number(item.smdUnitPrice) || 0))
  const dipUnitPrice = Math.max(0, Math.round(Number(item.dipUnitPrice) || 0))
  const materialUnitPrice = Math.max(0, Math.round(Number(item.materialUnitPrice) || 0))
  const productId = String(item.productId || '').trim()
  const isAdhoc = Boolean(item.isAdhoc) || isBillingOnlyOrderItem({ productId })
  const unitPrice = isAdhoc
    ? Math.max(0, Math.round(Number(item.unitPrice) || 0))
    : computeOrderLineAmortizedUnitPrice({
        quantity,
        setupCost,
        smdUnitPrice,
        dipUnitPrice,
        materialUnitPrice,
      }) || orderLinePerUnitPrice(smdUnitPrice, dipUnitPrice) + materialUnitPrice
  const materialCost = isAdhoc ? 0 : computeOrderLineMaterialCost(quantity, materialUnitPrice)
  const orderAmount = isAdhoc
    ? computeLineAmount(quantity, unitPrice)
    : computeOrderLineBreakdownAmount({
        quantity,
        setupCost,
        smdUnitPrice,
        dipUnitPrice,
        materialUnitPrice,
      })
  return {
    lineId: String(item.lineId || '').trim() || undefined,
    // 추가작업은 저장 시 product_id 를 비워 생산·출하가능에서 제외 (금액 전용)
    productId: isAdhoc ? null : productId || null,
    productCode: String(item.productCode || '').trim(),
    productName: String(item.productName || '').trim(),
    quantity,
    unitPrice,
    setupCost: isAdhoc ? 0 : setupCost,
    smdUnitPrice: isAdhoc ? unitPrice : smdUnitPrice,
    dipUnitPrice: isAdhoc ? 0 : dipUnitPrice,
    materialCost: isAdhoc ? 0 : materialCost,
    orderAmount,
    deliveryDate: String(item.deliveryDate || '').trim(),
    isAdhoc,
    /** 폼 선택용 id (추가작업 검증용, 저장하지 않음) */
    formProductId: productId || null,
  }
}

function matchRegisteredProduct(
  item: {
    productId: string | null
    productCode: string
    productName: string
  },
  products: Product[],
  customer: string,
  rowLabel: string,
) {
  const matched = resolveOrderLineProduct(products, customer, {
    productId: item.productId,
    productName: item.productName,
  })

  if (matched) return { ok: true as const, product: matched }

  if (item.productId) {
    return {
      ok: false as const,
      message: `${rowLabel} 제품명이 등록 정보와 다릅니다. 목록에서 다시 선택하세요.`,
    }
  }

  const sameCodeProducts = findProductsByCode(products, item.productCode, customer)
  const sameCodeNames = uniqueProductNames(sameCodeProducts)
  if (sameCodeNames.length > 1 && !item.productName) {
    return {
      ok: false as const,
      message: `${rowLabel} 같은 제품코드에 제품명이 ${sameCodeNames.length}개 있습니다. 드롭다운에서 제품명을 선택하세요.`,
    }
  }

  const sameNameVersions = findProductsByName(products, item.productName, customer)
  if (sameNameVersions.length > 1) {
    return {
      ok: false as const,
      message: `${rowLabel} 같은 제품명에 버전이 ${sameNameVersions.length}개 있습니다. 드롭다운에서 버전을 선택하세요.`,
    }
  }

  return {
    ok: false as const,
    message: `${rowLabel} 품목등록에 없는 제품입니다. 제품코드·제품명을 확인해 주세요.`,
  }
}

export function validateOrderItems(
  items: OrderItemForm[],
  products: Product[],
  customer: string,
  headerDeliveryDate = '',
) {
  const parsed = items
    .map(orderItemFormToModel)
    .filter(
      (item) =>
        item.productName ||
        item.productCode ||
        item.quantity > 0 ||
        item.orderAmount > 0,
    )

  if (!parsed.length) {
    return { ok: false as const, message: '제품을 1개 이상 입력하세요.' }
  }

  const validated: Array<{
    lineId?: string
    productId: string | null
    productCode: string
    productName: string
    quantity: number
    unitPrice: number
    setupCost: number
    smdUnitPrice: number
    dipUnitPrice: number
    materialCost: number
    orderAmount: number
    deliveryDate: string
    isAdhoc: boolean
  }> = []

  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index]!
    const rowLabel = `${index + 1}행`
    if (!item.productCode) {
      return { ok: false as const, message: `${rowLabel} 제품코드를 입력하세요.` }
    }
    if (!item.productName) {
      return { ok: false as const, message: `${rowLabel} 제품명을 입력하세요.` }
    }
    if (item.quantity <= 0) {
      return { ok: false as const, message: `${rowLabel} 수량은 0보다 커야 합니다.` }
    }
    if (item.unitPrice < 0) {
      return { ok: false as const, message: `${rowLabel} 단가는 0 이상이어야 합니다.` }
    }

    const matched = matchRegisteredProduct(
      {
        productId: item.formProductId || item.productId,
        productCode: item.productCode,
        productName: item.productName,
      },
      products,
      customer,
      rowLabel,
    )
    if (!matched.ok) {
      return matched
    }

    if (item.isAdhoc) {
      validated.push({
        lineId: item.lineId,
        productId: null,
        productCode: matched.product.productCode,
        productName: matched.product.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        setupCost: 0,
        smdUnitPrice: item.unitPrice,
        dipUnitPrice: 0,
        materialCost: 0,
        orderAmount: item.orderAmount,
        deliveryDate: headerDeliveryDate || item.deliveryDate,
        isAdhoc: true,
      })
      continue
    }

    validated.push({
      lineId: item.lineId,
      productId: matched.product.id,
      productCode: matched.product.productCode,
      productName: matched.product.productName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      setupCost: item.setupCost,
      smdUnitPrice: item.smdUnitPrice,
      dipUnitPrice: item.dipUnitPrice,
      materialCost: item.materialCost,
      orderAmount: item.orderAmount,
      deliveryDate: headerDeliveryDate || item.deliveryDate,
      isAdhoc: false,
    })
  }

  return { ok: true as const, items: validated }
}
