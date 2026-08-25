import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'
import type { DeliveryAvailability } from '@/lib/delivery/utils'
import { parseItemVersionCode } from '@/lib/items/version-code'
import type { LotAllocation, ProductionLot } from '@/lib/production-lots/types'
import { allocateLotsFifo, sumLotAllocationQuantity } from '@/lib/production-lots/utils'

export type DeliveryShippableOption = {
  uiKey: string
  assemblyGroupId: string
  orderNumber: string
  customerPoNumber: string
  customer: string
  deliveryDate: string
  productId?: string
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
  customerPoNumber: string
  customer: string
  productCode: string
  productName: string
  productVersion: string | null
  quantity: string
  unitPrice: string
  maxQuantity: number
  availableLots: ProductionLot[]
  allocations: LotAllocation[]
  lotManual: boolean
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
    customerPoNumber: '',
    customer: '',
    productCode: '',
    productName: '',
    productVersion: null,
    quantity: '',
    unitPrice: '0',
    maxQuantity: 0,
    availableLots: [],
    allocations: [],
    lotManual: false,
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
    const remaining =
      availability.targetQuantity > 0
        ? Math.max(0, availability.targetQuantity - availability.shipped)
        : Math.max(0, availability.shippable)
    const shippable = Math.max(0, availability.shippable)
    const maxQuantity =
      availability.targetQuantity > 0 ? Math.min(remaining, shippable) : shippable
    if (maxQuantity < 1) continue

    options.push({
      uiKey: order.uiKey,
      assemblyGroupId,
      orderNumber: order.orderNumber,
      customerPoNumber: order.customerPoNumber || '',
      customer: order.customer,
      deliveryDate: order.deliveryDate || '',
      productId: order.productId,
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
    customerPoNumber: option.customerPoNumber || '',
    customer: option.customer,
    productCode: option.productCode,
    productName: option.productName,
    productVersion: option.productVersion,
    unitPrice: String(Math.max(0, Math.round(Number(option.unitPrice) || 0))),
    maxQuantity: option.maxQuantity,
    // 수량은 직접 입력 — placeholder(가능 N)만 안내
    quantity: '',
    availableLots: [],
    allocations: [],
    lotManual: false,
  }
}

export function allocationsForRegisterQuantity(lots: ProductionLot[], quantity: number) {
  return allocateLotsFifo(lots, Math.max(0, Math.floor(Number(quantity) || 0)))
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
    if (item.lotManual) {
      const allocated = sumLotAllocationQuantity(item.allocations)
      if (allocated !== quantity) {
        return {
          ok: false,
          detail: `${item.productName || item.productCode} LOT 합계(${allocated.toLocaleString('ko-KR')})가 출하 수량과 다릅니다.`,
        }
      }
    }
  }

  return { ok: true, lines: filled, customer }
}

function shippableOptionSearchValues(option: DeliveryShippableOption) {
  return [
    option.productCode,
    option.productId || '',
    option.productName,
    option.productVersion || '',
    option.orderNumber,
    option.customerPoNumber,
    option.customer,
    option.deliveryDate,
    option.assemblyGroupId,
    parseItemVersionCode(option.productCode).base,
    parseItemVersionCode(option.productId || '').base,
  ]
}

export function filterDeliveryShippableOptions(options: DeliveryShippableOption[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return options
  const qBase = parseItemVersionCode(query.trim()).base.toLowerCase()
  return options.filter((option) => {
    const haystack = shippableOptionSearchValues(option).join(' ').toLowerCase()
    return haystack.includes(q) || (qBase !== q && haystack.includes(qBase))
  })
}

export function findExactShippableOptions(options: DeliveryShippableOption[], query: string) {
  const q = query.trim()
  if (!q) return [] as DeliveryShippableOption[]
  const qUpper = q.toUpperCase()
  const qBase = parseItemVersionCode(q).base.trim()
  const qBaseUpper = qBase.toUpperCase()

  return options.filter((option) => {
    const codes = [
      option.productCode,
      option.productId || '',
      parseItemVersionCode(option.productCode).base,
      parseItemVersionCode(option.productId || '').base,
    ]
      .map((value) => value.trim())
      .filter(Boolean)

    return codes.some((code) => {
      const upper = code.toUpperCase()
      return upper === qUpper || Boolean(qBase && upper === qBaseUpper)
    })
  })
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
