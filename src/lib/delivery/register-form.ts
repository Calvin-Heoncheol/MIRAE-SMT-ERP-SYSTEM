import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'
import type { DeliveryAvailability } from '@/lib/delivery/utils'

export type DeliveryShippableOption = {
  uiKey: string
  assemblyGroupId: string
  orderNumber: string
  customer: string
  productCode: string
  productName: string
  productVersion: string | null
  unitPrice: number
  maxQuantity: number
}

export type DeliveryRegisterItemForm = {
  key: string
  uiKey: string
  assemblyGroupId: string
  orderNumber: string
  customer: string
  productCode: string
  productName: string
  productVersion: string | null
  quantity: string
  unitPrice: string
  maxQuantity: number
}

let registerItemKeySeq = 0

export function createDeliveryRegisterItemKey() {
  registerItemKeySeq += 1
  return `delivery-item-${registerItemKeySeq}`
}

export function emptyDeliveryRegisterItemForm(): DeliveryRegisterItemForm {
  return {
    key: createDeliveryRegisterItemKey(),
    uiKey: '',
    assemblyGroupId: '',
    orderNumber: '',
    customer: '',
    productCode: '',
    productName: '',
    productVersion: null,
    quantity: '',
    unitPrice: '0',
    maxQuantity: 0,
  }
}

export function computeDeliveryLineAmount(quantity: number, unitPrice: number) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  const price = Math.max(0, Math.round(Number(unitPrice) || 0))
  return qty * price
}

export function buildDeliveryShippableOptions(
  orders: ProductionOrderLine[],
  availabilityByGroupId: Record<string, DeliveryAvailability>,
): DeliveryShippableOption[] {
  const options: DeliveryShippableOption[] = []

  for (const order of orders) {
    const assemblyGroupId = String(order.assemblyGroupId || order.orderLineId || '').trim()
    if (!assemblyGroupId) continue
    const availability = availabilityByGroupId[assemblyGroupId]
    if (!availability) continue
    const remaining = Math.max(0, availability.targetQuantity - availability.shipped)
    const maxQuantity = Math.min(remaining, Math.max(0, availability.shippable))
    if (maxQuantity < 1) continue

    options.push({
      uiKey: order.uiKey,
      assemblyGroupId,
      orderNumber: order.orderNumber,
      customer: order.customer,
      productCode: order.productCode,
      productName: formatProductionProductName(order),
      productVersion: order.productVersion,
      unitPrice: Math.max(0, Math.round(Number(order.unitPrice) || 0)),
      maxQuantity,
    })
  }

  return options.sort((a, b) => {
    const customerCompare = a.customer.localeCompare(b.customer, 'ko')
    if (customerCompare !== 0) return customerCompare
    const orderCompare = a.orderNumber.localeCompare(b.orderNumber, 'ko')
    if (orderCompare !== 0) return orderCompare
    return a.productCode.localeCompare(b.productCode, 'ko')
  })
}

export function applyShippableOptionToItem(
  item: DeliveryRegisterItemForm,
  option: DeliveryShippableOption,
): DeliveryRegisterItemForm {
  return {
    ...item,
    uiKey: option.uiKey,
    assemblyGroupId: option.assemblyGroupId,
    orderNumber: option.orderNumber,
    customer: option.customer,
    productCode: option.productCode,
    productName: option.productName,
    productVersion: option.productVersion,
    unitPrice: String(Math.max(0, Math.round(Number(option.unitPrice) || 0))),
    maxQuantity: option.maxQuantity,
    // 수량은 직접 입력 — placeholder(가능 N)만 안내
    quantity: '',
  }
}

export function validateDeliveryRegisterItems(
  items: DeliveryRegisterItemForm[],
):
  | { ok: true; lines: DeliveryRegisterItemForm[]; customer: string }
  | { ok: false; detail: string } {
  const filled = items.filter((item) => item.assemblyGroupId.trim() && item.productCode.trim())
  if (!filled.length) {
    return { ok: false, detail: '출하할 품목을 하나 이상 선택해 주세요.' }
  }

  const customer = filled[0]!.customer.trim()
  if (!customer) {
    return { ok: false, detail: '고객사 정보가 없는 품목입니다.' }
  }

  const seen = new Set<string>()
  for (const item of filled) {
    if (item.customer.trim() !== customer) {
      return { ok: false, detail: '같은 고객사 품목만 한 번에 출하할 수 있습니다.' }
    }
    const groupId = item.assemblyGroupId.trim()
    if (seen.has(groupId)) {
      return {
        ok: false,
        detail: `같은 품목(${item.productCode || item.productName})이 중복되었습니다.`,
      }
    }
    seen.add(groupId)

    const quantity = Math.floor(Number(item.quantity) || 0)
    if (quantity < 1) {
      return { ok: false, detail: `${item.productName || item.productCode} 수량을 입력해 주세요.` }
    }
    if (quantity > item.maxQuantity) {
      return {
        ok: false,
        detail: `${item.productName || item.productCode} 출하가능 수량(${item.maxQuantity.toLocaleString('ko-KR')})을 초과할 수 없습니다.`,
      }
    }
  }

  return { ok: true, lines: filled, customer }
}

export function formatDeliveryShippableOptionLabel(option: DeliveryShippableOption) {
  const version = option.productVersion?.trim()
  const codeLabel = version ? `${option.productCode} · ${version}` : option.productCode
  return `${codeLabel} · ${option.productName}`
}

export function formatDeliveryShippableOptionSubLabel(option: DeliveryShippableOption) {
  return [
    option.customer,
    option.orderNumber,
    `가능 ${option.maxQuantity.toLocaleString('ko-KR')}`,
  ]
    .filter(Boolean)
    .join(' · ')
}
