import type { OrderCategory, OrderLineItem, OrderListGroup, OrderRecord } from './types'
import { ORDER_CATEGORIES } from './types'

export const ORDER_CODE_MAX_LENGTH = 100

/** 레거시 MRO 자동 발급 코드 판별용 */
export const MRO_ORDER_CODE_PATTERN = /^MRO-[0-9]+$/

/** 고객사 접두사 자동 발급 코드 (SC-0001 등) */
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

export function formatOrderMoney(amount: number) {
  return `₩${Math.round(Number(amount) || 0).toLocaleString('ko-KR')}`
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

export function mapOrderLineRecord(line: {
  id?: string
  product_id?: string | null
  product_code: string
  product_name: string
  quantity: number
  unit_price: number
  order_amount: number
  derived_from_line_id?: string | null
}): OrderLineItem {
  return {
    lineId: line.id,
    productId: line.product_id || null,
    productCode: line.product_code || line.product_id || '',
    productName: line.product_name || '',
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unit_price) || 0,
    orderAmount: Number(line.order_amount) || 0,
    derivedFromLineId: line.derived_from_line_id || null,
  }
}

export function mapOrderRecord(
  record: OrderRecord,
  options?: { includeDerivedLines?: boolean },
): OrderListGroup {
  const lines = [...(record.order_lines || [])]
    .filter((line) => options?.includeDerivedLines || !line.derived_from_line_id)
    .sort((a, b) => a.line_seq - b.line_seq)
  const items = lines.map(mapOrderLineRecord)
  return {
    orderId: record.id,
    orderNumber: record.id,
    orderDate: formatOrderDate(record.order_date),
    deliveryDate: formatOrderDate(record.delivery_date),
    customer: record.customer || '',
    category: normalizeOrderCategory(record.category),
    note: record.note || '',
    source: record.source || 'manual',
    sourceQuoteId: record.source_quote_id,
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

export function formatInternalCodeLabel(code: string) {
  const value = code.trim()
  if (!value) return '—'
  if (value.length <= 14) return value
  return `${value.slice(0, 8)}…${value.slice(-4)}`
}

export function filterOrdersForSearch(orders: OrderListGroup[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return orders
  return orders.filter((order) => {
    const haystack = [
      order.orderNumber,
      order.customer,
      order.category,
      order.orderDate,
      order.deliveryDate,
      ...order.items.flatMap((item) => [item.productCode, item.productName]),
    ]
      .join(' ')
      .toLowerCase()
    return haystack.includes(q)
  })
}
