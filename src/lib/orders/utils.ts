import type { OrderCategory, OrderLineItem, OrderListGroup, OrderRecord } from './types'
import { ORDER_CATEGORIES } from './types'

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
    return b.orderNumber.localeCompare(a.orderNumber, undefined, { numeric: true })
  })
}

export function mapOrderLineRecord(line: {
  product_code: string
  product_name: string
  quantity: number
  unit_price: number
  order_amount: number
}): OrderLineItem {
  return {
    productCode: line.product_code || '',
    productName: line.product_name || '',
    quantity: Number(line.quantity) || 0,
    unitPrice: Number(line.unit_price) || 0,
    orderAmount: Number(line.order_amount) || 0,
  }
}

export function mapOrderRecord(record: OrderRecord): OrderListGroup {
  const lines = [...(record.order_lines || [])].sort((a, b) => a.line_seq - b.line_seq)
  const items = lines.map(mapOrderLineRecord)
  return {
    orderNumber: record.order_number,
    orderDate: formatOrderDate(record.order_date),
    deliveryDate: formatOrderDate(record.delivery_date),
    customer: record.customer || '',
    category: normalizeOrderCategory(record.category),
    source: record.source || 'manual',
    sourceQuoteNumber: record.source_quote_number,
    items,
    totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    totalAmount: items.reduce((sum, item) => sum + item.orderAmount, 0),
  }
}

export function groupOrdersFromRecords(records: OrderRecord[]): OrderListGroup[] {
  return sortOrderGroupsNewestFirst(records.map(mapOrderRecord))
}

export function formatProductSummary(group: OrderListGroup) {
  if (!group.items.length) return '-'
  const first = group.items[0]?.productName.trim() || '-'
  if (group.items.length === 1) return first
  return `${first} 외 ${group.items.length - 1}건`
}

export function generateOrderNumberPreview(existingNumbers: string[] = []) {
  const now = new Date()
  const yymm =
    String(now.getFullYear()).slice(2) + String(now.getMonth() + 1).padStart(2, '0')
  const prefix = `MRO${yymm}`
  let maxNumber = 0

  for (const orderNumber of existingNumbers) {
    if (orderNumber.startsWith(prefix)) {
      const numberPart = Number.parseInt(orderNumber.slice(prefix.length), 10)
      if (!Number.isNaN(numberPart) && numberPart > maxNumber) {
        maxNumber = numberPart
      }
    }
  }

  return `${prefix}${String(maxNumber + 1).padStart(3, '0')}`
}

export function computeLineAmount(quantity: number, unitPrice: number) {
  const qty = Math.max(0, Math.floor(Number(quantity) || 0))
  const price = Math.max(0, Math.round(Number(unitPrice) || 0))
  return qty * price
}
