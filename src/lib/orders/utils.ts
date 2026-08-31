import { paymentTermSnapshotFromDbRow } from '@/lib/partners/payment-term-snapshot'
import type { OrderCategory, OrderCurrency, OrderLineItem, OrderListGroup, OrderRecord } from './types'
import { ORDER_CATEGORIES } from './types'

export const ORDER_CODE_MAX_LENGTH = 100

/** 레거시 MRO-0001 순번 판별용 */
export const MRO_ORDER_CODE_PATTERN = /^MRO-[0-9]+$/

/** 신규 자동 발급: MRO-YYMMDD-NN */
export const MRO_DATE_ORDER_CODE_PATTERN = /^MRO-[0-9]{6}-[0-9]{2}$/

/** 고객사 접두사 레거시 자동 발급 코드 (SC-0001 등) */
export const AUTO_ORDER_CODE_PATTERN = /^[A-Z0-9]+-[0-9]+$/

export function normalizeOrderCodeInput(value: string) {
  return value.trim().toUpperCase()
}

export function validateOrderCodeInput(
  value: string,
): { ok: true; code: string } | { ok: false; message: string } {
  const code = normalizeOrderCodeInput(value)
  if (!code) return { ok: true, code: '' }
  if (code.length > ORDER_CODE_MAX_LENGTH) {
    return {
      ok: false,
      message: `주문코드는 ${ORDER_CODE_MAX_LENGTH}자 이하여야 합니다.`,
    }
  }
  return { ok: true, code }
}

export function normalizeOrderCurrency(value: string | null | undefined): OrderCurrency {
  return String(value || '').trim().toUpperCase() === 'USD' ? 'USD' : 'KRW'
}

export function formatOrderMoney(amount: number, currency: OrderCurrency = 'KRW') {
  const value = Math.round(Number(amount) || 0).toLocaleString('ko-KR')
  return currency === 'USD' ? `$${value}` : `₩${value}`
}

export function orderCurrencySymbol(currency: OrderCurrency = 'KRW') {
  return currency === 'USD' ? '$' : '₩'
}

/**
 * 금액 전용(추가작업) 라인.
 * product_id 가 없으면 생산·조립·출하가능·실적 집계에서 제외한다.
 * 폼의 isAdhoc 과 동일 규칙 — 판별은 항상 이 헬퍼를 쓴다.
 */
export function isBillingOnlyOrderItem(item: {
  productId?: string | null
}) {
  return !String(item.productId || '').trim()
}

/** DB order_lines 행용 (snake_case) */
export function isBillingOnlyOrderLine(line: {
  product_id?: string | null
}) {
  return !String(line.product_id || '').trim()
}

export function formatOrderDate(value: string | null | undefined) {
  if (!value) return ''
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : String(value)
}

export function todayYmdSeoul() {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul' }).format(new Date())
}

export function addDaysYmd(baseYmd: string, days: number) {
  const match = baseYmd.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!match) return baseYmd
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  date.setDate(date.getDate() + days)
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function normalizeOrderCategory(value: string | null | undefined): OrderCategory {
  const cat = String(value || '').trim()
  if (ORDER_CATEGORIES.includes(cat as OrderCategory)) return cat as OrderCategory
  if (cat === '확정') return '양산'
  return '양산'
}

export function parseOrderDateForSort(orderDate: string) {
  if (!orderDate) return 0
  const match = orderDate.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).getTime()
  }
  const parsed = Date.parse(orderDate)
  return Number.isNaN(parsed) ? 0 : parsed
}

export function sortOrderGroupsNewestFirst(groups: OrderListGroup[]) {
  return [...groups].sort((a, b) => {
    const dateDiff = parseOrderDateForSort(b.orderDate) - parseOrderDateForSort(a.orderDate)
    if (dateDiff !== 0) return dateDiff
    return b.createdAt.localeCompare(a.createdAt)
  })
}

export function mapOrderLineRecord(
  line: {
    id?: string
    product_id?: string | null
    product_code: string
    product_name: string
    quantity: number
    unit_price: number
    order_amount: number
    setup_cost?: number | null
    smd_unit_price?: number | null
    dip_unit_price?: number | null
    material_cost?: number | null
    delivery_date?: string | null
    derived_from_line_id?: string | null
  },
  fallbackDeliveryDate = '',
): OrderLineItem {
  const smd = Math.max(0, Math.round(Number(line.smd_unit_price) || 0))
  const dip = Math.max(0, Math.round(Number(line.dip_unit_price) || 0))
  const quantity = Number(line.quantity) || 0
  const setupCost = Math.max(0, Math.round(Number(line.setup_cost) || 0))
  const materialCost = Math.max(0, Math.round(Number(line.material_cost) || 0))
  const materialUnitPrice =
    quantity > 0 && materialCost > 0 ? Math.round(materialCost / quantity) : 0
  const unitPrice =
    smd + dip > 0 || setupCost > 0 || materialUnitPrice > 0
      ? computeOrderLineAmortizedUnitPrice({
          quantity,
          setupCost,
          smdUnitPrice: smd,
          dipUnitPrice: dip,
          materialUnitPrice,
        })
      : Math.max(0, Math.round(Number(line.unit_price) || 0))
  return {
    lineId: line.id,
    productId: line.product_id || null,
    productCode: line.product_code || line.product_id || '',
    productName: line.product_name || '',
    quantity,
    unitPrice,
    orderAmount: Number(line.order_amount) || 0,
    setupCost,
    smdUnitPrice: smd || unitPrice,
    dipUnitPrice: dip,
    materialCost,
    deliveryDate: formatOrderDate(line.delivery_date) || fallbackDeliveryDate,
    derivedFromLineId: line.derived_from_line_id || null,
  }
}

export function earliestDeliveryDate(dates: Array<string | null | undefined>) {
  const valid = dates
    .map((value) => formatOrderDate(value))
    .filter(Boolean)
    .sort()
  return valid[0] || ''
}

export function formatOrderDeliverySummary(order: Pick<OrderListGroup, 'deliveryDate' | 'items'>) {
  const dates = [
    ...new Set(
      order.items
        .map((item) => formatOrderDate(item.deliveryDate) || formatOrderDate(order.deliveryDate))
        .filter(Boolean),
    ),
  ].sort()
  if (!dates.length) return order.deliveryDate || '-'
  if (dates.length === 1) return dates[0]!
  return `${dates[0]} 외 ${dates.length - 1}`
}

export function mapOrderRecord(
  record: OrderRecord,
  options?: { includeDerivedLines?: boolean },
): OrderListGroup {
  const headerDeliveryDate = formatOrderDate(record.delivery_date)
  const lines = [...(record.order_lines || [])]
    .filter((line) => options?.includeDerivedLines || !line.derived_from_line_id)
    .sort((a, b) => a.line_seq - b.line_seq)
  const items = lines.map((line) => mapOrderLineRecord(line, headerDeliveryDate))
  return {
    orderId: record.id,
    orderNumber: record.id,
    orderDate: formatOrderDate(record.order_date),
    deliveryDate: earliestDeliveryDate(items.map((item) => item.deliveryDate)) || headerDeliveryDate,
    customer: record.customer || '',
    category: normalizeOrderCategory(record.category),
    currency: normalizeOrderCurrency(record.currency),
    note: record.note || '',
    customerPoNumber: record.customer_po_number || '',
    source: record.source || 'manual',
    sourceQuoteId: record.source_quote_id,
    paymentTerms: paymentTermSnapshotFromDbRow(record),
    createdBy: record.created_by ?? null,
    createdByName: String(record.created_by_name || '').trim(),
    createdAt: record.created_at,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.orderAmount, 0),
  }
}

export function groupOrdersFromRecords(
  records: OrderRecord[],
  options?: { includeDerivedLines?: boolean },
): OrderListGroup[] {
  return sortOrderGroupsNewestFirst(records.map((record) => mapOrderRecord(record, options)))
}

export function formatProductSummary(group: OrderListGroup) {
  if (!group.items.length) return '-'
  const first = group.items[0]?.productName.trim() || '-'
  if (group.items.length === 1) return first
  return `${first} 외 ${group.items.length - 1}건`
}

export function computeLineAmount(quantity: number, unitPrice: number) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  const price = Math.max(0, Math.round(Number(unitPrice) || 0))
  return qty * price
}

/** 발주 라인 단가 = SET-UP÷수량 + SMD + 후공정 + 자재(대당) */
export function computeOrderLineAmortizedUnitPrice(input: {
  quantity: number
  setupCost: number
  smdUnitPrice: number
  dipUnitPrice: number
  materialUnitPrice?: number
}) {
  const qty = Math.max(0, Math.floor(Number(input.quantity) || 0))
  const setup = Math.max(0, Math.round(Number(input.setupCost) || 0))
  const smd = Math.max(0, Math.round(Number(input.smdUnitPrice) || 0))
  const dip = Math.max(0, Math.round(Number(input.dipUnitPrice) || 0))
  const material = Math.max(0, Math.round(Number(input.materialUnitPrice) || 0))
  const setupPerUnit = qty > 0 ? Math.round(setup / qty) : 0
  return setupPerUnit + smd + dip + material
}

/** 발주 라인 자재비 총액 = 수량 × 자재(대당) */
export function computeOrderLineMaterialCost(quantity: number, materialUnitPrice: number) {
  return computeLineAmount(quantity, materialUnitPrice)
}

/** 발주 라인 금액 = 단가 × 수량 */
export function computeOrderLineBreakdownAmount(input: {
  quantity: number
  setupCost: number
  smdUnitPrice: number
  dipUnitPrice: number
  materialUnitPrice?: number
}) {
  const unitPrice = computeOrderLineAmortizedUnitPrice(input)
  return computeLineAmount(input.quantity, unitPrice)
}

/** 대당 가공 단가 (SMD + 후공정, SET-UP 제외) */
export function orderLinePerUnitPrice(smdUnitPrice: number, dipUnitPrice: number) {
  return Math.max(0, Math.round(Number(smdUnitPrice) || 0) + Math.round(Number(dipUnitPrice) || 0))
}

export function formatInternalCodeLabel(code: string) {
  const value = code.trim()
  if (!value) return '—'
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

/** 화면 표시용 발주번호 — 고객 PO 우선, 없으면 내부 발주ID */
export function displayOrderPoNumber(
  customerPoNumber: string | undefined | null,
  orderId: string | undefined | null,
) {
  return String(customerPoNumber || '').trim() || String(orderId || '').trim()
}

export function filterOrdersForSearch(orders: OrderListGroup[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return orders
  return orders.filter((order) => {
    const haystack = [
      order.orderNumber,
      order.customerPoNumber,
      order.customer,
      order.category,
      order.orderDate,
      order.deliveryDate,
      order.note,
      ...order.items.flatMap((item) => [item.productCode, item.productName]),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
