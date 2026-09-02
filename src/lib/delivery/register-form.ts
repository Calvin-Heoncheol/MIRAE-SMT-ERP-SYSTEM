import type { ProductionOrderLine } from '@/lib/production-input/types'
import { formatProductionProductName } from '@/lib/production-input/utils'
import { DELIVERY_REGISTER_SKIP_PRODUCTION_CAP } from '@/lib/delivery/config'
import type { DeliveryAvailability, DeliveryBillingOnlyLine } from '@/lib/delivery/utils'
import type { ProductionStatusLine } from '@/lib/production-status/types'
import {
  findBillingAnchorProductIndex,
  resolveBillingQuantityFromShipped,
} from '@/lib/delivery/utils'
import { parseItemVersionCode } from '@/lib/items/version-code'
import type { Product } from '@/lib/products/types'
import { filterProductsForCustomerStrict, resolveProductInput } from '@/lib/products/utils'
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
  /** 실제 출하 가능 수량 (생산 완료 − 이미 출하) */
  maxQuantity: number
  /** 발주 잔량 (목표 − 출하누적) */
  orderRemaining: number
  /** 생산 완료 기준 출하 가능 */
  shippableQuantity: number
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
  /** 발주 추가작업(금액 전용) — 출하 수량/LOT 없음, 명세 행용 */
  billingOnly?: boolean
  orderLineId?: string
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
    billingOnly: false,
    orderLineId: '',
  }
}

export function computeDeliveryLineAmount(quantity: number, unitPrice: number) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  const price = Math.max(0, Math.round(Number(unitPrice) || 0))
  return qty * price
}

export function billingRegisterAssemblyKey(orderLineId: string) {
  return `billing:${String(orderLineId || '').trim()}`
}

export function isBillingRegisterItem(item: DeliveryRegisterItemForm) {
  return Boolean(item.billingOnly)
}

/** 출하 등록 화면 순서(제품 → 추가작업) 그대로 거래명세서 품목 입력으로 변환 */
export function registerItemsToStatementShippedLines(items: DeliveryRegisterItemForm[]) {
  return items
    .filter((item) => {
      const qty = Math.floor(Number(item.quantity) || 0)
      if (qty < 1) return false
      if (isBillingRegisterItem(item)) {
        return Boolean(item.productName.trim())
      }
      return Boolean(item.assemblyGroupId.trim() && item.productCode.trim())
    })
    .map((item) => ({
      orderNumber: item.orderNumber.trim(),
      productCode: item.productCode.trim(),
      productName: item.productName.trim(),
      qty: Math.floor(Number(item.quantity) || 0),
      unitPrice: Math.round(Number(item.unitPrice) || 0),
      billingOnly: isBillingRegisterItem(item),
      orderLineId: isBillingRegisterItem(item) ? String(item.orderLineId || '').trim() : undefined,
    }))
}

export function applyBillingLineToItem(
  item: DeliveryRegisterItemForm,
  line: DeliveryBillingOnlyLine,
  companionQuantity?: number,
): DeliveryRegisterItemForm {
  const orderLineId = String(line.orderLineId || '').trim()
  const quantity =
    companionQuantity != null
      ? Math.max(0, Math.floor(Number(companionQuantity) || 0))
      : Math.max(0, Math.floor(Number(line.quantity) || 0))
  const unitPrice = Math.max(0, Math.round(Number(line.unitPrice) || 0))
  return {
    ...item,
    billingOnly: true,
    orderLineId,
    uiKey: billingRegisterAssemblyKey(orderLineId),
    assemblyGroupId: billingRegisterAssemblyKey(orderLineId),
    orderNumber: line.orderNumber,
    customerPoNumber: line.customerPoNumber || '',
    customer: line.customer,
    productCode: line.productCode,
    productName: line.productName,
    productVersion: null,
    quantity: quantity > 0 ? String(quantity) : '',
    unitPrice: String(unitPrice),
    maxQuantity: 0,
    availableLots: [],
    allocations: [],
    lotManual: false,
  }
}

/** 출하 품목에 연결된 발주 중, 아직 넣지 않은 추가작업 목록 */
export function availableBillingLinesForRegister(
  items: DeliveryRegisterItemForm[],
  billingLines: DeliveryBillingOnlyLine[],
): DeliveryBillingOnlyLine[] {
  const orderIds = new Set(
    items
      .filter((item) => !isBillingRegisterItem(item))
      .map((item) => item.orderNumber.trim())
      .filter(Boolean),
  )
  const usedLineIds = new Set(
    items
      .filter((item) => isBillingRegisterItem(item))
      .map((item) => String(item.orderLineId || '').trim())
      .filter(Boolean),
  )

  return billingLines.filter((line) => {
    const orderNumber = line.orderNumber.trim()
    const orderLineId = String(line.orderLineId || '').trim()
    if (!orderNumber || !orderLineId) return false
    if (!orderIds.has(orderNumber)) return false
    return !usedLineIds.has(orderLineId)
  })
}

/** 제품 출하 행이 없는 발주의 추가작업 행 제거 */
export function pruneOrphanBillingRegisterItems(
  items: DeliveryRegisterItemForm[],
): DeliveryRegisterItemForm[] {
  const orderIds = new Set(
    items
      .filter((item) => !isBillingRegisterItem(item))
      .map((item) => item.orderNumber.trim())
      .filter(Boolean),
  )
  return items.filter(
    (item) => !isBillingRegisterItem(item) || orderIds.has(item.orderNumber.trim()),
  )
}

function suggestedBillingQuantity(
  items: DeliveryRegisterItemForm[],
  line: DeliveryBillingOnlyLine,
) {
  const orderProducts = items.filter(
    (item) =>
      !isBillingRegisterItem(item) && item.orderNumber.trim() === line.orderNumber.trim(),
  )
  return resolveBillingQuantityFromShipped({
    billingProductCode: line.productCode,
    billingProductName: line.productName,
    shippedLines: orderProducts.map((item) => ({
      productCode: item.productCode,
      productName: item.productName,
      quantity: Math.floor(Number(item.quantity) || 0),
    })),
  })
}

/** 선택한 추가작업을 해당 발주 제품 행 아래에 삽입 */
export function insertBillingRegisterItem(
  items: DeliveryRegisterItemForm[],
  line: DeliveryBillingOnlyLine,
): DeliveryRegisterItemForm[] {
  if (availableBillingLinesForRegister(items, [line]).length === 0) return items

  const companion = applyBillingLineToItem(
    emptyDeliveryRegisterItemForm(),
    line,
    suggestedBillingQuantity(items, line),
  )

  const productItems = items.filter((item) => !isBillingRegisterItem(item))
  const anchorIndex = findBillingAnchorProductIndex(line, productItems)
  if (anchorIndex < 0) {
    return [...items, companion]
  }

  const anchorKey = productItems[anchorIndex]!.key
  const result: DeliveryRegisterItemForm[] = []
  for (const item of items) {
    result.push(item)
    if (item.key === anchorKey) result.push(companion)
  }
  return result
}

function hasProductionStatusTarget(input: { smtTarget: number; postTarget: number }) {
  return input.smtTarget > 0 || input.postTarget > 0
}

function isProductionStatusComplete(input: {
  smtTarget: number
  smtProduced: number
  postTarget: number
  postProduced: number
}) {
  const hasSmt = input.smtTarget > 0
  const hasPost = input.postTarget > 0
  if (!hasSmt && !hasPost) return false
  const smtDone = !hasSmt || input.smtProduced >= input.smtTarget
  const postDone = !hasPost || input.postProduced >= input.postTarget
  return smtDone && postDone
}

/** 생산현황「진행중」과 동일 기준 — 출하 등록에 연결 가능한 조립그룹 ID */
export function collectActiveDeliveryAssemblyGroupIds(lines: ProductionStatusLine[]) {
  const ids = new Set<string>()
  for (const line of lines) {
    if (line.products.length === 0) continue
    for (const product of line.products) {
      if (!hasProductionStatusTarget(product) && product.smtChildren.length === 0) continue
      if (isProductionStatusComplete(product)) continue
      for (const id of product.assemblyGroupIds) {
        const trimmed = id.trim()
        if (trimmed) ids.add(trimmed)
      }
    }
  }
  return ids
}

/** 출하 등록 UI·검증용 최대 수량. 임시 모드에서는 발주 잔량만 적용 */
export function resolveDeliveryRegisterMaxQuantity(availability: DeliveryAvailability): number {
  const orderRemaining =
    availability.targetQuantity > 0
      ? Math.max(0, availability.targetQuantity - availability.shipped)
      : 0
  const shippableQuantity = Math.max(0, availability.shippable)

  if (DELIVERY_REGISTER_SKIP_PRODUCTION_CAP) {
    return availability.targetQuantity > 0 ? orderRemaining : 0
  }

  return availability.targetQuantity > 0
    ? Math.min(orderRemaining, shippableQuantity)
    : shippableQuantity
}

/** RPC p_max_shippable — 임시 모드에서는 발주 잔량, 아니면 생산완료 기준 shippable */
export function resolveDeliveryRecordMaxShippable(input: {
  targetQuantity: number
  currentTotal: number
  requestQuantity: number
  shippable: number
}) {
  const targetQuantity = Math.max(0, Math.floor(input.targetQuantity))
  const currentTotal = Math.max(0, Math.floor(input.currentTotal))
  const requestQuantity = Math.max(1, Math.floor(input.requestQuantity))
  const shippable = Math.max(0, Math.floor(input.shippable))

  if (DELIVERY_REGISTER_SKIP_PRODUCTION_CAP) {
    if (targetQuantity > 0) return Math.max(0, targetQuantity - currentTotal)
    return requestQuantity
  }

  return shippable
}

function buildRegisterOptionFromOrder(
  order: ProductionOrderLine,
  availabilityByGroupId: Record<string, DeliveryAvailability>,
): DeliveryShippableOption | null {
  const assemblyGroupId = String(order.assemblyGroupId || order.orderLineId || '').trim()
  if (!assemblyGroupId) return null
  const availability = availabilityByGroupId[assemblyGroupId]
  if (!availability) return null

  const orderRemaining =
    availability.targetQuantity > 0
      ? Math.max(0, availability.targetQuantity - availability.shipped)
      : 0
  const shippableQuantity = Math.max(0, availability.shippable)
  const maxQuantity = resolveDeliveryRegisterMaxQuantity(availability)

  return {
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
    orderRemaining: availability.targetQuantity > 0 ? orderRemaining : shippableQuantity,
    shippableQuantity,
  }
}

/** 출하 등록 — 생산현황「진행중」 발주·품목만 후보로 사용 */
export function buildDeliveryRegisterOrderOptions(
  productionStatusLines: ProductionStatusLine[],
  orders: ProductionOrderLine[],
  availabilityByGroupId: Record<string, DeliveryAvailability>,
): DeliveryShippableOption[] {
  const activeGroupIds = collectActiveDeliveryAssemblyGroupIds(productionStatusLines)
  const options: DeliveryShippableOption[] = []

  for (const order of orders) {
    const assemblyGroupId = String(order.assemblyGroupId || order.orderLineId || '').trim()
    if (!assemblyGroupId || !activeGroupIds.has(assemblyGroupId)) continue
    const option = buildRegisterOptionFromOrder(order, availabilityByGroupId)
    if (option) options.push(option)
  }

  return options.sort((a, b) => {
    const customerCompare = a.customer.localeCompare(b.customer, 'ko')
    if (customerCompare !== 0) return customerCompare
    const orderCompare = a.orderNumber.localeCompare(b.orderNumber, 'ko')
    if (orderCompare !== 0) return orderCompare
    return a.productCode.localeCompare(b.productCode, 'ko')
  })
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
    const orderRemaining =
      availability.targetQuantity > 0
        ? Math.max(0, availability.targetQuantity - availability.shipped)
        : 0
    const shippableQuantity = Math.max(0, availability.shippable)

    if (availability.targetQuantity > 0) {
      if (orderRemaining < 1) continue
    } else if (shippableQuantity < 1 && !DELIVERY_REGISTER_SKIP_PRODUCTION_CAP) {
      continue
    }

    const maxQuantity = resolveDeliveryRegisterMaxQuantity(availability)

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
      orderRemaining: availability.targetQuantity > 0 ? orderRemaining : shippableQuantity,
      shippableQuantity,
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
  options?: { autoFillQuantity?: boolean },
): DeliveryRegisterItemForm {
  const maxQuantity = Math.max(0, Math.floor(Number(option.maxQuantity) || 0))
  return {
    ...item,
    billingOnly: false,
    orderLineId: '',
    uiKey: option.uiKey,
    assemblyGroupId: option.assemblyGroupId,
    orderNumber: option.orderNumber,
    customerPoNumber: option.customerPoNumber || '',
    customer: option.customer,
    productCode: option.productCode,
    productName: option.productName,
    productVersion: option.productVersion,
    unitPrice: String(Math.max(0, Math.round(Number(option.unitPrice) || 0))),
    maxQuantity,
    quantity:
      options?.autoFillQuantity && maxQuantity > 0 ? String(maxQuantity) : '',
    availableLots: [],
    allocations: [],
    lotManual: false,
  }
}

export const DELIVERY_REGISTER_MIN_ROWS = 3

/** 출하 등록 테이블 — 최소 행 수를 맞춤 */
export function padDeliveryRegisterItems(
  items: DeliveryRegisterItemForm[],
  customer: string,
  minRows = DELIVERY_REGISTER_MIN_ROWS,
): DeliveryRegisterItemForm[] {
  const customerName = customer.trim()
  const productRows = items.filter((item) => !isBillingRegisterItem(item))
  const billingRows = items.filter((item) => isBillingRegisterItem(item))
  const next = [...productRows]
  while (next.length < minRows) {
    next.push({ ...emptyDeliveryRegisterItemForm(), customer: customerName })
  }
  return [...next, ...billingRows]
}

export function productMatchesShippableOption(
  option: DeliveryShippableOption,
  customer: string,
  product: Pick<Product, 'id' | 'productCode' | 'productName'>,
) {
  const customerName = customer.trim()
  const productCode = product.productCode.trim()
  const productName = product.productName.trim()
  if (customerName && option.customer !== customerName) return false
  if (product.id && option.productId === product.id) return true
  if (productCode && option.productCode.trim() === productCode) {
    if (!productName || option.productName.trim() === productName) return true
  }
  if (productName && option.productName.trim() === productName) return true
  return false
}

export function findShippableOptionsForProduct(
  options: DeliveryShippableOption[],
  customer: string,
  product: Pick<Product, 'id' | 'productCode' | 'productName'>,
): DeliveryShippableOption[] {
  return options.filter((option) => productMatchesShippableOption(option, customer, product))
}

export function findShippableOptionForProduct(
  options: DeliveryShippableOption[],
  customer: string,
  product: Product,
): DeliveryShippableOption | null {
  return findShippableOptionsForProduct(options, customer, product)[0] ?? null
}

export function findShippableOptionsForRegisterItem(
  options: DeliveryShippableOption[],
  customer: string,
  item: Pick<DeliveryRegisterItemForm, 'productCode' | 'productName' | 'productVersion'>,
  productId?: string,
): DeliveryShippableOption[] {
  const customerName = customer.trim()
  const productCode = item.productCode.trim()
  const productName = item.productName.trim()
  if (!productCode && !productName) return []

  return options.filter((option) => {
    if (customerName && option.customer !== customerName) return false
    if (productId && option.productId === productId) return true
    if (productCode && option.productCode.trim() === productCode) {
      if (!productName || option.productName.trim() === productName) return true
    }
    if (productName && option.productName.trim() === productName) return true
    return false
  })
}

export function isDeliveryRegisterQuantityEnabled(item: DeliveryRegisterItemForm) {
  if (isBillingRegisterItem(item)) return true
  const hasProduct = Boolean(item.productCode.trim() || item.productName.trim())
  if (!hasProduct) return false
  return Boolean(item.assemblyGroupId.trim())
}

export function applyProductToRegisterItem(
  item: DeliveryRegisterItemForm,
  product: Product,
  options: DeliveryShippableOption[],
  customer: string,
  autoFillQuantity = false,
): DeliveryRegisterItemForm {
  const customerName = customer.trim()
  const unitPrice = String(Math.max(0, Math.round(product.defaultUnitPrice)))
  const matches = findShippableOptionsForProduct(options, customerName, product)
  const option = matches.length === 1 ? matches[0]! : null
  const base = option
    ? applyShippableOptionToItem(item, option, { autoFillQuantity })
    : {
        ...item,
        billingOnly: false,
        orderLineId: '',
        uiKey: '',
        assemblyGroupId: '',
        orderNumber: '',
        customerPoNumber: '',
        customer: customerName,
        maxQuantity: 0,
        availableLots: [],
        allocations: [],
        lotManual: false,
      }

  return {
    ...base,
    customer: customerName || base.customer,
    productCode: product.productCode,
    productName: product.productName,
    productVersion: product.version || null,
    unitPrice,
  }
}

export function allocationsForRegisterQuantity(lots: ProductionLot[], quantity: number) {
  return allocateLotsFifo(lots, Math.max(0, Math.floor(Number(quantity) || 0)))
}

function formatDeliveryRegisterRowLabel(item: DeliveryRegisterItemForm) {
  const code = item.productCode.trim()
  const name = item.productName.trim()
  if (code && name) return `${name}(${code})`
  return name || code || '입력한 품목'
}

function isAttemptedDeliveryRegisterRow(item: DeliveryRegisterItemForm) {
  if (isBillingRegisterItem(item)) return false
  return Boolean(
    item.productCode.trim() ||
      item.productName.trim() ||
      Math.floor(Number(item.quantity) || 0) >= 1,
  )
}

export type ValidateDeliveryRegisterItemsContext = {
  customer?: string
  products?: Product[]
  orderOptions?: DeliveryShippableOption[]
}

export function validateDeliveryRegisterItems(
  items: DeliveryRegisterItemForm[],
  context?: ValidateDeliveryRegisterItemsContext,
): | { ok: true; lines: DeliveryRegisterItemForm[]; customer: string }
  | { ok: false; detail: string } {
  const customerName = String(context?.customer || '').trim()
  const catalog = customerName
    ? filterProductsForCustomerStrict(context?.products ?? [], customerName)
    : []

  const attempted = items.filter(isAttemptedDeliveryRegisterRow)
  if (!attempted.length) {
    return { ok: false, detail: '출하할 품목을 하나 이상 입력해 주세요.' }
  }

  const lines: DeliveryRegisterItemForm[] = []

  for (const item of attempted) {
    const label = formatDeliveryRegisterRowLabel(item)
    const code = item.productCode.trim()
    const name = item.productName.trim()
    const quantity = Math.floor(Number(item.quantity) || 0)

    if (!code && !name) {
      if (quantity >= 1) {
        return {
          ok: false,
          detail: '수량만 입력된 행이 있습니다. 품목코드 또는 품목명을 품목등록에서 선택해 주세요.',
        }
      }
      continue
    }

    if (!code || !name) {
      return {
        ok: false,
        detail: `${label}: 품목등록에서 품목을 선택해 주세요. 품목코드와 품목명이 함께 채워져야 합니다.`,
      }
    }

    if (!customerName) {
      return { ok: false, detail: '고객사를 선택해 주세요.' }
    }

    if (catalog.length) {
      const resolved = resolveProductInput(catalog, customerName, code, name)
      if (resolved.status === 'none') {
        return {
          ok: false,
          detail: `${label}: 품목등록에 없거나 선택한 고객사(${customerName}) 품목이 아닙니다. 드롭다운에서 품목을 선택했는지 확인해 주세요.`,
        }
      }
      if (resolved.status === 'ambiguous') {
        return {
          ok: false,
          detail: `${code}: 같은 품목코드의 버전이 여러 개입니다. 드롭다운에서 버전을 선택해 주세요.`,
        }
      }
      const product = resolved.product
      if (product.productName.trim() !== name) {
        return {
          ok: false,
          detail: `${label}: 품목코드와 품목명이 품목등록 정보(${product.productCode} · ${product.productName})와 일치하지 않습니다.`,
        }
      }
    } else if (code && name) {
      return {
        ok: false,
        detail: `${label}: 선택한 고객사(${customerName})에 등록된 품목이 없습니다. 품목등록에서 고객사·품목을 확인해 주세요.`,
      }
    }

    if (quantity < 1) {
      return { ok: false, detail: `${label}: 출하 수량을 입력해 주세요.` }
    }

    if (!item.assemblyGroupId.trim()) {
      const orderCandidates = findShippableOptionsForRegisterItem(
        context?.orderOptions ?? [],
        customerName,
        item,
      )
      if (!orderCandidates.length) {
        return {
          ok: false,
          detail: `${label}: 진행중인 발주서가 없습니다. 생산현황에서 진행 중인 발주에 등록된 품목만 출하할 수 있습니다.`,
        }
      }
      return {
        ok: false,
        detail: `${label}: 발주번호를 선택해 주세요. 같은 품목이 여러 발주에 있을 때는 발주를 지정해야 합니다.`,
      }
    }

    lines.push(item)
  }

  if (!lines.length) {
    return { ok: false, detail: '출하할 품목을 하나 이상 입력해 주세요.' }
  }

  const customer = lines[0]!.customer.trim() || customerName
  if (!customer) {
    return { ok: false, detail: '고객사 정보가 없는 품목입니다.' }
  }

  const seen = new Set<string>()
  for (const item of lines) {
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
        detail: DELIVERY_REGISTER_SKIP_PRODUCTION_CAP
          ? `${item.productName || item.productCode} 발주 잔량(${item.maxQuantity.toLocaleString('ko-KR')})을 초과할 수 없습니다.`
          : `${item.productName || item.productCode} 출하가능 수량(${item.maxQuantity.toLocaleString('ko-KR')})을 초과할 수 없습니다.`,
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

  return { ok: true, lines, customer }
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
    `발주 ${option.orderRemaining.toLocaleString('ko-KR')}`,
    `가능 ${option.shippableQuantity.toLocaleString('ko-KR')}`,
  ]
    .filter(Boolean)
    .join(' · ')
}
