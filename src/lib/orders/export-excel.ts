import type { ExcelColumn } from '@/lib/excel/export'
import { parseItemVersionCode, stripTrailingVersionFromName } from '@/lib/items/version-code'
import type { OrderLineItem, OrderListGroup } from '@/lib/orders/types'

export type OrderLineExportRow = {
  customerPoNumber: string
  productCode: string
  productName: string
  version: string
  quantity: number
  unitPrice: number
}

function resolveOrderLineExportFields(item: OrderLineItem) {
  const parsed = parseItemVersionCode(item.productCode || item.productId || '')
  const version = parsed.version || ''
  const productCode = parsed.base || item.productCode.trim()
  const productName =
    stripTrailingVersionFromName(item.productName, version) || item.productName.trim()

  return { productCode, productName, version }
}

/** 주문 1행·제품 N행 — BOM 펼침 라인(derived)은 목록과 동일하게 제외된 items 기준 */
export function buildOrderLineExportRows(orders: OrderListGroup[]): OrderLineExportRow[] {
  return orders.flatMap((order) => {
    const customerPoNumber = order.customerPoNumber.trim() || order.orderNumber

    if (!order.items.length) {
      return [
        {
          customerPoNumber,
          productCode: '',
          productName: '',
          version: '',
          quantity: 0,
          unitPrice: 0,
        },
      ]
    }

    return order.items.map((item) => {
      const fields = resolveOrderLineExportFields(item)
      return {
        customerPoNumber,
        ...fields,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }
    })
  })
}

export const ORDER_LINE_EXPORT_COLUMNS: ExcelColumn<OrderLineExportRow>[] = [
  { header: '발주번호', value: (row) => row.customerPoNumber, width: 20 },
  { header: '제품코드', value: (row) => row.productCode, width: 18 },
  { header: '제품명', value: (row) => row.productName, width: 28 },
  { header: '버전', value: (row) => row.version, width: 10 },
  { header: '수량', value: (row) => row.quantity, width: 10 },
  { header: '단가', value: (row) => row.unitPrice, width: 12 },
]
