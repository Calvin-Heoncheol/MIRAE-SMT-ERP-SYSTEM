import { fetchOrders } from '@/lib/orders/repository'
import type { OrderCurrency } from '@/lib/orders/types'
import { addDaysYmd, displayOrderPoNumber, normalizeOrderCurrency } from '@/lib/orders/utils'
import { formatItemDisplayCode } from '@/lib/items/utils'
import { parseItemVersionCode } from '@/lib/items/version-code'
import { fetchProducts } from '@/lib/products/repository'
import {
  ensureLegacyShipmentNumber,
  isLegacyShipmentNote,
  isLegacyStatementOrder,
  orderIdFromLegacyShipmentNote,
  parseLegacyShipmentIdFromOrderNote,
} from '@/lib/reports/legacy-statement'
import { createSupabaseClient } from '@/lib/supabase'

export type SalesReportCustomerRow = {
  customer: string
  /** 기간 내 발주 건수 */
  orderCount: number
  /** 기간 내 발주 금액 (발주서 금액 합) */
  orderAmount: number
  /** 기간 내 출하 수량 */
  shippedQuantity: number
  /** 기간 내 출하 금액 (수량 × 판매 단가) */
  shippedAmount: number
}

export type SalesReportShipmentRow = {
  recordDate: string
  deliveryId: string
  /** 거래명세서 묶음번호 — 같은 값이면 한 장 */
  shipmentId: string
  /** 발주ID (MRO-…) — 수정·삭제용 */
  orderId: string
  /** 발주번호 (고객 PO). 없으면 발주ID */
  orderNumber: string
  customer: string
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  amount: number
  /** 발주서 표시 통화 */
  currency: OrderCurrency
  source: 'delivery' | 'legacy'
  orderLineId: string
}

/** 같은 출하번호(거래명세서)를 한 행으로 묶은 결과 */
export type SalesReportStatementGroup = {
  recordDate: string
  shipmentId: string
  /** 발주ID — 수정·삭제용 */
  orderId: string
  /** 발주번호 (고객 PO) */
  orderNumber: string
  customer: string
  productCode: string
  productName: string
  quantity: number
  unitPrice: number
  unitPriceMixed: boolean
  amount: number
  currency: OrderCurrency
  currencyMixed: boolean
  source: 'delivery' | 'legacy'
  lines: SalesReportShipmentRow[]
}

export function groupSalesReportShipments(
  rows: SalesReportShipmentRow[],
): SalesReportStatementGroup[] {
  const groups = new Map<string, SalesReportShipmentRow[]>()
  for (const row of rows) {
    const key = String(row.shipmentId || row.deliveryId || '').trim()
    if (!key) continue
    const list = groups.get(key) || []
    list.push(row)
    groups.set(key, list)
  }

  const result: SalesReportStatementGroup[] = []
  for (const [shipmentId, lines] of groups) {
    const sortedLines = [...lines].sort((a, b) => {
      const byDate = b.recordDate.localeCompare(a.recordDate)
      if (byDate !== 0) return byDate
      return String(b.deliveryId).localeCompare(String(a.deliveryId))
    })
    const first = sortedLines[0]!
    const recordDate = sortedLines.reduce(
      (latest, line) => (line.recordDate > latest ? line.recordDate : latest),
      first.recordDate,
    )
    const customers = [
      ...new Set(sortedLines.map((line) => line.customer.trim()).filter(Boolean)),
    ]
    const orderIds = [
      ...new Set(sortedLines.map((line) => line.orderId.trim()).filter(Boolean)),
    ]
    const orderNumbers = [
      ...new Set(sortedLines.map((line) => line.orderNumber.trim()).filter(Boolean)),
    ]
    const productNames = [
      ...new Set(sortedLines.map((line) => line.productName.trim()).filter(Boolean)),
    ]
    const productCodes = [
      ...new Set(sortedLines.map((line) => line.productCode.trim()).filter(Boolean)),
    ]
    const prices = [...new Set(sortedLines.map((line) => line.unitPrice))]
    const currencies = [...new Set(sortedLines.map((line) => normalizeOrderCurrency(line.currency)))]
    const sources = [...new Set(sortedLines.map((line) => line.source))]
    result.push({
      recordDate,
      shipmentId,
      orderId: orderIds.join(', '),
      orderNumber: orderNumbers.join(', '),
      customer: customers[0] || '',
      productCode: productCodes.length === 1 ? productCodes[0]! : '',
      productName:
        productNames.length <= 1
          ? productNames[0] || ''
          : `${productNames[0]} 외 ${productNames.length - 1}건`,
      quantity: sortedLines.reduce((sum, line) => sum + line.quantity, 0),
      unitPrice: prices.length === 1 ? prices[0]! : 0,
      unitPriceMixed: prices.length !== 1,
      amount: sortedLines.reduce((sum, line) => sum + line.amount, 0),
      currency: currencies.length === 1 ? currencies[0]! : 'KRW',
      currencyMixed: currencies.length !== 1,
      source: sources.length === 1 ? sources[0]! : first.source,
      lines: sortedLines,
    })
  }

  return result.sort((a, b) => {
    const byDate = b.recordDate.localeCompare(a.recordDate)
    if (byDate !== 0) return byDate
    return b.shipmentId.localeCompare(a.shipmentId)
  })
}

export type SalesReportDailyRow = {
  date: string
  orderCount: number
  orderAmount: number
  shippedQuantity: number
  shippedAmount: number
}

export type SalesReportData = {
  startDate: string
  endDate: string
  totalOrderCount: number
  /** 원화 발주 금액 합 */
  totalOrderAmount: number
  /** 달러 발주 금액 합 */
  totalOrderAmountUsd: number
  totalShippedQuantity: number
  /** 원화 출하 금액 합 */
  totalShippedAmount: number
  /** 달러 출하 금액 합 */
  totalShippedAmountUsd: number
  customers: SalesReportCustomerRow[]
  daily: SalesReportDailyRow[]
  shipments: SalesReportShipmentRow[]
}

export type FetchSalesReportResult =
  | { ok: true; data: SalesReportData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

type DeliveryRecordRow = {
  id: string
  shipment_id?: string | null
  record_date: string
  assembly_group_id: string | null
  quantity: number
  note?: string | null
}

type GroupInfo = {
  orderId: string
  customerPoNumber: string
  customer: string
  parentProductId: string
  productCode: string
  productName: string
  itemUnitPrice: number
  currency: OrderCurrency
}

function displayPoNumber(customerPoNumber: string | undefined, orderId: string) {
  return displayOrderPoNumber(customerPoNumber, orderId)
}

const IN_CHUNK_SIZE = 150

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function normalizeCustomer(value: string | null | undefined): string {
  return String(value ?? '').trim() || '(고객사 미지정)'
}

export async function fetchSalesReportData(
  startDate: string,
  endDate: string,
): Promise<FetchSalesReportResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()

    // ── 1. 기간 내 발주 (발주일 기준) + 출하 기록 + 과거 명세서 ──
    const [ordersResult, legacyOrdersResult, deliveryQuery] = await Promise.all([
      fetchOrders(),
      fetchOrders({ legacyOnly: true }),
      supabase
        .from('delivery_records')
        .select('id, shipment_id, record_date, assembly_group_id, quantity, note')
        .gte('record_date', startDate)
        .lte('record_date', endDate),
    ])

    let deliveryRowsRaw: DeliveryRecordRow[] | null = (deliveryQuery.data ||
      null) as DeliveryRecordRow[] | null
    let deliveryError = deliveryQuery.error

    if (deliveryError && /shipment_id/i.test(deliveryError.message)) {
      const legacy = await supabase
        .from('delivery_records')
        .select('id, record_date, assembly_group_id, quantity, note')
        .gte('record_date', startDate)
        .lte('record_date', endDate)
      deliveryRowsRaw = (legacy.data || null) as DeliveryRecordRow[] | null
      deliveryError = legacy.error
    }

    if (!ordersResult.ok) {
      return ordersResult
    }
    if (!legacyOrdersResult.ok) {
      return legacyOrdersResult
    }
    if (deliveryError) {
      return { ok: false, reason: 'query', detail: deliveryError.message }
    }

    const periodOrders = ordersResult.orders.filter(
      (order) => order.orderDate >= startDate && order.orderDate <= endDate,
    )
    const legacyOrders = legacyOrdersResult.orders.filter(
      (order) =>
        isLegacyStatementOrder(order) &&
        order.orderDate >= startDate &&
        order.orderDate <= endDate,
    )
    const deliveryRows = (deliveryRowsRaw || []) as DeliveryRecordRow[]
    const orderById = new Map(
      [...ordersResult.orders, ...legacyOrdersResult.orders].map((order) => [order.orderId, order]),
    )

    // ── 2. 출하 기록 → 조립그룹(주문·고객사·조립제품) ──────────────
    const groupIds = [
      ...new Set(deliveryRows.map((row) => row.assembly_group_id).filter(Boolean)),
    ] as string[]
    const groupInfoById = new Map<string, GroupInfo>()

    for (const ids of chunk(groupIds, IN_CHUNK_SIZE)) {
      let { data, error } = await supabase
        .from('order_assembly_groups')
        .select(
          'id, order_id, parent_product_id, items!order_assembly_groups_parent_product_id_fkey(id, name, unit_price, base_code, version), orders(customer, customer_po_number)',
        )
        .in('id', ids)
      if (error && /customer_po_number/i.test(error.message)) {
        const fallback = await supabase
          .from('order_assembly_groups')
          .select(
            'id, order_id, parent_product_id, items!order_assembly_groups_parent_product_id_fkey(id, name, unit_price, base_code, version), orders(customer)',
          )
          .in('id', ids)
        data = (fallback.data || []).map((row) => ({
          ...row,
          orders: Array.isArray(row.orders)
            ? row.orders.map((order: { customer?: string | null }) => ({
                customer: order.customer,
                customer_po_number: null,
              }))
            : row.orders
              ? {
                  customer: (row.orders as { customer?: string | null }).customer,
                  customer_po_number: null,
                }
              : null,
        })) as typeof data
        error = fallback.error
      }
      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }
      for (const row of data || []) {
        const items = row.items as
          | {
              id?: string | null
              name?: string | null
              unit_price?: number | null
              base_code?: string | null
              version?: string | null
            }
          | {
              id?: string | null
              name?: string | null
              unit_price?: number | null
              base_code?: string | null
              version?: string | null
            }[]
          | null
        const item = Array.isArray(items) ? items[0] : items
        const orders = row.orders as
          | { customer?: string | null; customer_po_number?: string | null }
          | { customer?: string | null; customer_po_number?: string | null }[]
          | null
        const orderRow = Array.isArray(orders) ? orders[0] : orders
        const orderId = String(row.order_id ?? '')
        const parentProductId = String(row.parent_product_id ?? '').trim()
        groupInfoById.set(String(row.id), {
          orderId,
          customerPoNumber:
            String(orderRow?.customer_po_number ?? '').trim() ||
            orderById.get(orderId)?.customerPoNumber.trim() ||
            '',
          customer: String(orderRow?.customer ?? '').trim(),
          parentProductId,
          productCode: formatItemDisplayCode({
            id: String(item?.id || parentProductId),
            baseCode: String(item?.base_code || ''),
          }),
          productName: String(item?.name ?? '').trim() || parentProductId,
          itemUnitPrice: Math.max(0, Math.round(Number(item?.unit_price) || 0)),
          currency: normalizeOrderCurrency(orderById.get(orderId)?.currency),
        })
      }
    }

    // ── 3. 출하 판매 단가: 주문라인(조립제품) 우선, 품목 단가 폴백 ──
    const shipOrderIds = [...new Set([...groupInfoById.values()].map((info) => info.orderId).filter(Boolean))]
    /** orderId → (productId → unitPrice) */
    const linePriceByOrder = new Map<string, Map<string, number>>()

    for (const ids of chunk(shipOrderIds, IN_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('order_lines')
        .select('order_id, product_id, product_code, unit_price, derived_from_line_id')
        .in('order_id', ids)
      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }
      for (const row of data || []) {
        const orderId = String(row.order_id ?? '')
        const unitPrice = Math.max(0, Math.round(Number(row.unit_price) || 0))
        const keys = [row.product_id, row.product_code]
          .map((value) => String(value ?? '').trim())
          .filter(Boolean)
        if (!linePriceByOrder.has(orderId)) {
          linePriceByOrder.set(orderId, new Map())
        }
        const priceByProduct = linePriceByOrder.get(orderId)!
        for (const key of keys) {
          const existing = priceByProduct.get(key)
          if (existing == null || (existing <= 0 && unitPrice > 0 && !row.derived_from_line_id)) {
            priceByProduct.set(key, unitPrice)
          }
        }
      }
    }

    function resolveShipUnitPrice(info: GroupInfo): number {
      const fromLine = linePriceByOrder.get(info.orderId)?.get(info.parentProductId) ?? 0
      if (fromLine > 0) return fromLine
      return info.itemUnitPrice
    }

    const productsResult = await fetchProducts(false)
    if (productsResult.ok) {
      const productById = Object.fromEntries(
        productsResult.products.map((product) => [product.id, product]),
      )
      for (const info of groupInfoById.values()) {
        const master = productById[info.parentProductId]
        if (master?.productCode.trim()) {
          info.productCode = master.productCode.trim()
          continue
        }
        const parsed = parseItemVersionCode(info.parentProductId)
        if (
          parsed.base &&
          parsed.base !== info.parentProductId &&
          (!info.productCode.trim() || info.productCode === info.parentProductId)
        ) {
          info.productCode = parsed.base
        }
      }
    }

    // ── 4. 출하 상세 행 ─────────────────────────────────────────
    const shipments: SalesReportShipmentRow[] = []
    const legacyShipmentByOrderId = new Map<string, string>()
    for (const row of deliveryRows) {
      const orderId = orderIdFromLegacyShipmentNote(row.note)
      if (orderId && row.id) {
        legacyShipmentByOrderId.set(orderId, String(row.shipment_id || row.id).trim() || String(row.id))
      }
    }

    for (const row of deliveryRows) {
      if (!row.assembly_group_id || isLegacyShipmentNote(row.note)) continue
      const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0))
      if (quantity <= 0) continue
      const info = row.assembly_group_id ? groupInfoById.get(String(row.assembly_group_id)) : undefined
      const unitPrice = info ? resolveShipUnitPrice(info) : 0
      const orderId = info?.orderId ?? ''
      shipments.push({
        recordDate: String(row.record_date ?? ''),
        deliveryId: String(row.id ?? ''),
        shipmentId: String(row.shipment_id || row.id || '').trim() || String(row.id ?? ''),
        orderId,
        orderNumber: displayPoNumber(info?.customerPoNumber, orderId),
        customer: info?.customer ?? '',
        productCode: info?.productCode ?? '',
        productName: info?.productName ?? '',
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
        currency: info?.currency ?? 'KRW',
        source: 'delivery',
        orderLineId: '',
      })
    }

    for (const order of legacyOrders) {
      const userLines = order.items.filter((item) => !item.derivedFromLineId)
      const totalQty = userLines.reduce((sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)), 0)
      let shipmentId =
        legacyShipmentByOrderId.get(order.orderId) ||
        parseLegacyShipmentIdFromOrderNote(order.note)
      if (!shipmentId) {
        shipmentId = await ensureLegacyShipmentNumber({
          orderId: order.orderId,
          shipDate: order.orderDate,
          quantity: totalQty,
          orderNote: order.note,
        })
        if (shipmentId) legacyShipmentByOrderId.set(order.orderId, shipmentId)
      }
      const displayShipmentId = shipmentId || order.orderNumber
      for (const item of userLines) {
        const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
        const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
        const amount = Math.max(0, Math.round(Number(item.orderAmount) || quantity * unitPrice))
        if (quantity <= 0 && amount <= 0) continue
        shipments.push({
          recordDate: item.deliveryDate || order.orderDate,
          deliveryId: displayShipmentId,
          shipmentId: displayShipmentId,
          orderId: order.orderId,
          orderNumber: displayPoNumber(order.customerPoNumber, order.orderId || order.orderNumber),
          customer: order.customer,
          productCode:
            String(item.productCode || '').trim() ||
            formatItemDisplayCode({ id: String(item.productId || ''), baseCode: '' }),
          productName: item.productName || '과거 명세서',
          quantity,
          unitPrice,
          amount,
          currency: normalizeOrderCurrency(order.currency),
          source: 'legacy',
          orderLineId: item.lineId || '',
        })
      }
    }

    shipments.sort((a, b) => a.recordDate.localeCompare(b.recordDate))

    // ── 5. 거래처별 집계 ────────────────────────────────────────
    const customerMap = new Map<string, SalesReportCustomerRow>()

    function customerRow(customer: string): SalesReportCustomerRow {
      const key = normalizeCustomer(customer)
      const existing = customerMap.get(key)
      if (existing) return existing
      const created: SalesReportCustomerRow = {
        customer: key,
        orderCount: 0,
        orderAmount: 0,
        shippedQuantity: 0,
        shippedAmount: 0,
      }
      customerMap.set(key, created)
      return created
    }

    for (const order of [...periodOrders, ...legacyOrders]) {
      const row = customerRow(order.customer)
      row.orderCount += 1
      row.orderAmount += Math.max(0, Math.round(order.totalAmount))
    }

    for (const shipment of shipments) {
      const row = customerRow(shipment.customer)
      row.shippedQuantity += shipment.quantity
      row.shippedAmount += shipment.amount
    }

    const customers = [...customerMap.values()].sort(
      (a, b) => b.orderAmount + b.shippedAmount - (a.orderAmount + a.shippedAmount),
    )

    // ── 6. 일별 추이 ────────────────────────────────────────────
    const dailyMap = new Map<string, SalesReportDailyRow>()
    // 안전장치: 잘못된 날짜 형식으로 무한루프 방지 (최대 62일)
    for (
      let date = startDate, steps = 0;
      date <= endDate && steps < 62;
      date = addDaysYmd(date, 1), steps += 1
    ) {
      dailyMap.set(date, {
        date,
        orderCount: 0,
        orderAmount: 0,
        shippedQuantity: 0,
        shippedAmount: 0,
      })
    }

    for (const order of [...periodOrders, ...legacyOrders]) {
      const row = dailyMap.get(order.orderDate)
      if (!row) continue
      row.orderCount += 1
      row.orderAmount += Math.max(0, Math.round(order.totalAmount))
    }

    for (const shipment of shipments) {
      const row = dailyMap.get(shipment.recordDate)
      if (!row) continue
      row.shippedQuantity += shipment.quantity
      row.shippedAmount += shipment.amount
    }

    const daily = [...dailyMap.values()]

    const allOrders = [...periodOrders, ...legacyOrders]
    const totalOrderAmount = allOrders
      .filter((order) => normalizeOrderCurrency(order.currency) === 'KRW')
      .reduce((sum, order) => sum + Math.max(0, Math.round(order.totalAmount)), 0)
    const totalOrderAmountUsd = allOrders
      .filter((order) => normalizeOrderCurrency(order.currency) === 'USD')
      .reduce((sum, order) => sum + Math.max(0, Math.round(order.totalAmount)), 0)
    const totalShippedAmount = shipments
      .filter((row) => row.currency === 'KRW')
      .reduce((sum, row) => sum + row.amount, 0)
    const totalShippedAmountUsd = shipments
      .filter((row) => row.currency === 'USD')
      .reduce((sum, row) => sum + row.amount, 0)

    return {
      ok: true,
      data: {
        startDate,
        endDate,
        totalOrderCount: allOrders.length,
        totalOrderAmount,
        totalOrderAmountUsd,
        totalShippedQuantity: shipments.reduce((sum, row) => sum + row.quantity, 0),
        totalShippedAmount,
        totalShippedAmountUsd,
        customers,
        daily,
        shipments,
      },
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export type FetchLegacyStatementGroupsResult =
  | { ok: true; groups: SalesReportStatementGroup[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

/** 과거 거래명세서 — 출하등록 화면 목록·인쇄용 */
export async function fetchLegacyStatementGroups(): Promise<FetchLegacyStatementGroupsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return {
      ok: false,
      reason: 'env',
      detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.',
    }
  }

  try {
    const supabase = createSupabaseClient()
    const [legacyOrdersResult, deliveryQuery] = await Promise.all([
      fetchOrders({ legacyOnly: true }),
      supabase.from('delivery_records').select('id, shipment_id, note'),
    ])

    if (!legacyOrdersResult.ok) {
      return legacyOrdersResult
    }

    let deliveryRows = (deliveryQuery.data || []) as DeliveryRecordRow[]
    if (deliveryQuery.error && /shipment_id/i.test(deliveryQuery.error.message)) {
      const legacy = await supabase.from('delivery_records').select('id, note')
      if (legacy.error) {
        return { ok: false, reason: 'query', detail: legacy.error.message }
      }
      deliveryRows = (legacy.data || []) as DeliveryRecordRow[]
    } else if (deliveryQuery.error) {
      return { ok: false, reason: 'query', detail: deliveryQuery.error.message }
    }

    const legacyOrders = legacyOrdersResult.orders.filter((order) => isLegacyStatementOrder(order))
    const legacyShipmentByOrderId = new Map<string, string>()
    for (const row of deliveryRows) {
      const orderId = orderIdFromLegacyShipmentNote(row.note)
      if (orderId && row.id) {
        legacyShipmentByOrderId.set(
          orderId,
          String(row.shipment_id || row.id).trim() || String(row.id),
        )
      }
    }

    const shipments: SalesReportShipmentRow[] = []
    for (const order of legacyOrders) {
      const userLines = order.items.filter((item) => !item.derivedFromLineId)
      const totalQty = userLines.reduce(
        (sum, item) => sum + Math.max(0, Math.floor(Number(item.quantity) || 0)),
        0,
      )
      let shipmentId =
        legacyShipmentByOrderId.get(order.orderId) ||
        parseLegacyShipmentIdFromOrderNote(order.note)
      if (!shipmentId) {
        shipmentId = await ensureLegacyShipmentNumber({
          orderId: order.orderId,
          shipDate: order.orderDate,
          quantity: totalQty,
          orderNote: order.note,
        })
        if (shipmentId) legacyShipmentByOrderId.set(order.orderId, shipmentId)
      }
      const displayShipmentId = shipmentId || order.orderNumber
      for (const item of userLines) {
        const quantity = Math.max(0, Math.floor(Number(item.quantity) || 0))
        const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
        const amount = Math.max(0, Math.round(Number(item.orderAmount) || quantity * unitPrice))
        if (quantity <= 0 && amount <= 0) continue
        shipments.push({
          recordDate: item.deliveryDate || order.orderDate,
          deliveryId: displayShipmentId,
          shipmentId: displayShipmentId,
          orderId: order.orderId,
          orderNumber: displayPoNumber(order.customerPoNumber, order.orderId || order.orderNumber),
          customer: order.customer,
          productCode:
            String(item.productCode || '').trim() ||
            formatItemDisplayCode({ id: String(item.productId || ''), baseCode: '' }),
          productName: item.productName || '과거 명세서',
          quantity,
          unitPrice,
          amount,
          currency: normalizeOrderCurrency(order.currency),
          source: 'legacy',
          orderLineId: item.lineId || '',
        })
      }
    }

    return { ok: true, groups: groupSalesReportShipments(shipments) }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
