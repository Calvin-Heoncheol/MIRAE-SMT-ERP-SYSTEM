import { fetchOrderById } from '@/lib/orders/repository'
import type { OrderCurrency } from '@/lib/orders/types'
import { isBillingOnlyOrderItem, normalizeOrderCurrency } from '@/lib/orders/utils'
import {
  buildDeliveryBillingOnlyLines,
  interleaveStatementShippedLinesWithBilling,
  resolveStatementDisplayProductCode,
  type StatementShippedLine,
} from '@/lib/delivery/utils'
import { findActiveBusinessPartnerByName } from '@/lib/partners/repository'
import type { DeliveryStatementData, DeliveryStatementLine } from './types'

async function resolveCustomerContact(customerName: string) {
  const partner = await findActiveBusinessPartnerByName(customerName)
  return {
    address: String(partner?.address || '').trim(),
    phone: String(partner?.phone || '').trim(),
  }
}

function isCollapsedProductLabel(name: string) {
  return /외\s*\d+\s*건/.test(String(name || '').trim())
}

function statementLinesFromOrderItems(
  order: NonNullable<Awaited<ReturnType<typeof fetchOrderById>>>,
  fallbackOrderNumber = '',
): DeliveryStatementLine[] {
  return order.items
    .filter((item) => !item.derivedFromLineId)
    .map((item) => {
      const qty = Math.max(0, Math.floor(Number(item.quantity) || 0))
      const unitPrice = Math.max(0, Math.round(Number(item.unitPrice) || 0))
      const supplyAmount =
        Math.max(0, Math.round(Number(item.orderAmount) || 0)) || Math.round(qty * unitPrice)
      return {
        orderNumber: order.orderNumber || fallbackOrderNumber,
        productCode: String(item.productCode || '').trim(),
        productName: String(item.productName || '').trim(),
        qty,
        unitPrice,
        supplyAmount,
        billingOnly: isBillingOnlyOrderItem(item),
      }
    })
    .filter((item) => item.qty > 0 || item.supplyAmount > 0)
}

type StatementShippedLineInput = {
  orderNumber: string
  productCode: string
  productName: string
  qty: number
  unitPrice?: number | null
  billingOnly?: boolean
  orderLineId?: string
}

function normalizeStatementShippedLines(lines: StatementShippedLineInput[]) {
  return (lines || [])
    .map((line) => ({
      orderNumber: String(line.orderNumber || '').trim(),
      productCode: String(line.productCode || '').trim(),
      productName: String(line.productName || '').trim(),
      qty: Math.max(0, Math.floor(Number(line.qty) || 0)),
      unitPrice:
        line.unitPrice != null ? Math.max(0, Math.round(Number(line.unitPrice) || 0)) : null,
      billingOnly: Boolean(line.billingOnly),
      orderLineId: String(line.orderLineId || '').trim(),
    }))
    .filter(
      (line) =>
        line.qty > 0 &&
        (line.productCode || line.productName) &&
        (line.billingOnly || line.orderNumber),
    )
}

/**
 * 혼합 출하(여러 주문·품목) 거래명세서 — docNo = shipment_id
 */
export async function buildDeliveryStatementDataFromShipment(input: {
  shipmentId: string
  shipDate: string
  customer: string
  note?: string
  shippedLines: StatementShippedLineInput[]
}): Promise<
  | { ok: true; data: DeliveryStatementData }
  | { ok: false; detail: string }
> {
  const shipmentId = String(input.shipmentId || '').trim()
  if (!shipmentId) {
    return { ok: false, detail: '명세서 번호가 없습니다.' }
  }

  const shippedLines = normalizeStatementShippedLines(input.shippedLines || [])

  if (!shippedLines.length) {
    return { ok: false, detail: '출하 품목이 없습니다.' }
  }

  const orderCache = new Map<string, Awaited<ReturnType<typeof fetchOrderById>>>()

  async function getOrder(orderNumber: string) {
    if (!orderNumber) return null
    if (orderCache.has(orderNumber)) return orderCache.get(orderNumber) ?? null
    const order = await fetchOrderById(orderNumber)
    orderCache.set(orderNumber, order)
    return order
  }

  function matchOrderProductLine(
    order: Awaited<ReturnType<typeof fetchOrderById>>,
    productCode: string,
    productName: string,
  ) {
    const orderLines = (order?.items || []).filter((item) => !item.derivedFromLineId)
    const code = productCode.trim().toLowerCase()
    const name = productName.trim().toLowerCase()
    return (
      (code
        ? orderLines.find(
            (item) =>
              !isBillingOnlyOrderItem(item) &&
              (String(item.productCode || '').trim().toLowerCase() === code ||
                String(item.productId || '').trim().toLowerCase() === code),
          )
        : null) ||
      (name
        ? orderLines.find(
            (item) =>
              !isBillingOnlyOrderItem(item) &&
              String(item.productName || '').trim().toLowerCase() === name,
          )
        : null) ||
      (code
        ? orderLines.find(
            (item) =>
              String(item.productCode || '').trim().toLowerCase() === code ||
              String(item.productId || '').trim().toLowerCase() === code,
          )
        : null) ||
      (name
        ? orderLines.find((item) => String(item.productName || '').trim().toLowerCase() === name)
        : null)
    )
  }

  let normalizedShippedLines: StatementShippedLine[] = shippedLines
  const hasExplicitBilling = shippedLines.some((line) => line.billingOnly)

  if (!hasExplicitBilling) {
    const productOnly = shippedLines.filter((line) => !line.billingOnly)
    const orderIds = [...new Set(productOnly.map((line) => line.orderNumber).filter(Boolean))]
    const enrichedProducts = await Promise.all(
      productOnly.map(async (line) => {
        const order = await getOrder(line.orderNumber)
        const matched = matchOrderProductLine(order, line.productCode, line.productName)
        return {
          orderNumber: line.orderNumber,
          productCode: line.productCode,
          productName: line.productName,
          qty: line.qty,
          unitPrice: line.unitPrice,
          productId: String(matched?.productId || line.productCode).trim() || undefined,
          orderProductCode: String(matched?.productCode || '').trim() || undefined,
        }
      }),
    )
    const billingLines: ReturnType<typeof buildDeliveryBillingOnlyLines> = []
    for (const orderNumber of orderIds) {
      const order = await getOrder(orderNumber)
      if (order) billingLines.push(...buildDeliveryBillingOnlyLines([order]))
    }
    normalizedShippedLines = interleaveStatementShippedLinesWithBilling(
      enrichedProducts,
      billingLines,
    )
  }

  const items: DeliveryStatementLine[] = []
  const expandedOrders = new Set<string>()

  for (const line of normalizedShippedLines) {
    if (line.billingOnly) {
      const unitPrice = line.unitPrice ?? 0
      items.push({
        orderNumber: line.orderNumber,
        productCode: line.productCode,
        productName: line.productName,
        qty: line.qty,
        unitPrice,
        supplyAmount: Math.round(line.qty * unitPrice),
        billingOnly: true,
      })
      continue
    }

    const order = await getOrder(line.orderNumber)
    if (order && isCollapsedProductLabel(line.productName)) {
      if (!expandedOrders.has(order.orderNumber)) {
        items.push(...statementLinesFromOrderItems(order, line.orderNumber))
        expandedOrders.add(order.orderNumber)
      }
      continue
    }

    const matched = matchOrderProductLine(order, line.productCode, line.productName)

    const unitPrice =
      line.unitPrice != null
        ? line.unitPrice
        : Math.max(0, Math.round(Number(matched?.unitPrice) || 0))
    const qty = line.qty
    items.push({
      orderNumber: line.orderNumber || order?.orderNumber || '',
      productCode: resolveStatementDisplayProductCode({
        productCode: line.productCode,
        productId: matched?.productId ?? undefined,
        orderProductCode: matched?.productCode,
      }),
      productName: line.productName || String(matched?.productName || '').trim(),
      qty,
      unitPrice,
      supplyAmount: Math.round(qty * unitPrice),
    })
  }

  if (!items.some((item) => item.productName || item.productCode)) {
    return { ok: false, detail: '출하 품목 정보를 찾을 수 없습니다.' }
  }

  const uniqueOrders = [
    ...new Set(
      items
        .map((item) => String(item.orderNumber || '').trim())
        .filter((orderNumber): orderNumber is string => Boolean(orderNumber)),
    ),
  ]
  const customer = String(input.customer || '').trim()
  const contact = await resolveCustomerContact(customer)

  const currencies: OrderCurrency[] = []
  for (const orderNumber of uniqueOrders) {
    const order = await getOrder(orderNumber)
    if (order) currencies.push(normalizeOrderCurrency(order.currency))
  }
  const currency: OrderCurrency =
    currencies.length > 0 && currencies.every((value) => value === 'USD') ? 'USD' : 'KRW'

  return {
    ok: true,
    data: {
      docNo: shipmentId,
      shipDate: String(input.shipDate || '').trim(),
      orderNumber: uniqueOrders[0] || '',
      customer,
      customerAddress: contact.address,
      customerPhone: contact.phone,
      note: String(input.note || '').trim(),
      currency,
      items,
    },
  }
}
