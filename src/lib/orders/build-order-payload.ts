import type { OrderItemForm } from './form-state'
import { computeLineAmount } from './utils'

export function orderItemFormToModel(item: OrderItemForm) {
  const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
  const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
  return {
    productCode: String(item.productCode || '').trim(),
    productName: String(item.productName || '').trim(),
    quantity,
    unitPrice,
    orderAmount: computeLineAmount(quantity, unitPrice),
  }
}

export function validateOrderItems(items: OrderItemForm[]) {
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
  }

  return { ok: true as const, items: parsed }
}
