import type { OrderItemForm } from './form-state'
import { resolveOrderLineProduct } from '@/lib/products/utils'
import type { Product } from '@/lib/products/types'
import { computeLineAmount } from './utils'

export function orderItemFormToModel(item: OrderItemForm) {
  const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
  const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
  const productId = String(item.productId || '').trim()
  return {
    productId: productId || null,
    productCode: String(item.productCode || '').trim(),
    productName: String(item.productName || '').trim(),
    quantity,
    unitPrice,
    orderAmount: computeLineAmount(quantity, unitPrice),
    deliveryDate: String(item.deliveryDate || '').trim(),
  }
}

export function validateOrderItems(
  items: OrderItemForm[],
  products: Product[],
  customer: string,
) {
  const parsed = items
    .map(orderItemFormToModel)
    .filter(
      (item) =>
        item.productName ||
        item.productCode ||
        item.quantity > 0 ||
        item.orderAmount > 0 ||
        item.deliveryDate,
    )

  if (!parsed.length) {
    return { ok: false as const, message: '제품을 1개 이상 입력하세요.' }
  }

  const validated: ReturnType<typeof orderItemFormToModel>[] = []

  for (let index = 0; index < parsed.length; index += 1) {
    const item = parsed[index]
    if (!item.productName) {
      return { ok: false as const, message: `${index + 1}행 제품명을 입력하세요.` }
    }
    if (item.quantity <= 0) {
      return { ok: false as const, message: `${index + 1}행 수량은 0보다 커야 합니다.` }
    }
    if (item.unitPrice < 0) {
      return { ok: false as const, message: `${index + 1}행 단가는 0 이상이어야 합니다.` }
    }
    if (!item.deliveryDate) {
      return { ok: false as const, message: `${index + 1}행 납기일을 입력하세요.` }
    }

    const matched = resolveOrderLineProduct(products, customer, {
      productId: item.productId,
      productName: item.productName,
    })

    if (!matched) {
      if (item.productId) {
        return {
          ok: false as const,
          message: `${index + 1}행 제품명이 등록 정보와 다릅니다. 목록에서 다시 선택하세요.`,
        }
      }
      return {
        ok: false as const,
        message: `${index + 1}행 해당 제품은 등록되어 있지 않습니다. 제품명을 다시 확인해 주시기 바랍니다.`,
      }
    }

    validated.push({
      ...item,
      productId: matched.id,
      productCode: matched.productCode,
      productName: matched.productName,
    })
  }

  return { ok: true as const, items: validated }
}
