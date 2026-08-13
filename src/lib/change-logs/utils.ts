import { ITEM_CATEGORY_LABELS, type ItemCategory } from '@/lib/items/types'

function amount(value: number) {
  return Math.round(Number(value) || 0).toLocaleString('ko-KR')
}

function pushDiff(
  parts: string[],
  label: string,
  before: string | number | null | undefined,
  after: string | number | null | undefined,
) {
  const a = String(before ?? '').trim()
  const b = String(after ?? '').trim()
  if (a === b) return
  if (!a && !b) return
  parts.push(`${label} ${a || '—'} → ${b || '—'}`)
}

/** tag=false 이면 인상/인하 라벨 없이 「라벨 전 → 후」만 */
function pushMoneyDiff(
  parts: string[],
  label: string,
  before: number,
  after: number,
  options?: { tag?: boolean },
) {
  const a = Math.round(Number(before) || 0)
  const b = Math.round(Number(after) || 0)
  if (a === b) return
  const withTag = options?.tag !== false
  if (!withTag) {
    parts.push(`${label} ${amount(a)} → ${amount(b)}`)
    return
  }
  if (b > a) {
    parts.push(`가격인상 ↑ ${label} ${amount(a)} → ${amount(b)}`)
  } else {
    parts.push(`가격인하 ↓ ${label} ${amount(a)} → ${amount(b)}`)
  }
}

export function buildOrderChangeDetail(input: {
  before: {
    customer: string
    category: string
    note: string
    customerPoNumber: string
    orderDate: string
    deliveryDate: string
    lineCount: number
    totalAmount: number
    totalQuantity: number
  }
  after: {
    customer: string
    category: string
    note: string
    customerPoNumber: string
    orderDate: string
    deliveryDate: string
    lineCount: number
    totalAmount: number
    totalQuantity: number
  }
}) {
  const parts: string[] = []
  pushDiff(parts, '고객', input.before.customer, input.after.customer)
  pushDiff(parts, '구분', input.before.category, input.after.category)
  pushDiff(parts, '발주번호', input.before.customerPoNumber, input.after.customerPoNumber)
  pushDiff(parts, '주문일', input.before.orderDate, input.after.orderDate)
  pushDiff(parts, '납기', input.before.deliveryDate, input.after.deliveryDate)
  pushMoneyDiff(parts, '합계금액', input.before.totalAmount, input.after.totalAmount)
  if (input.before.totalQuantity !== input.after.totalQuantity) {
    parts.push(
      `합계수량 ${input.before.totalQuantity.toLocaleString('ko-KR')} → ${input.after.totalQuantity.toLocaleString('ko-KR')}`,
    )
  }
  if (input.before.lineCount !== input.after.lineCount) {
    parts.push(`품목수 ${input.before.lineCount} → ${input.after.lineCount}`)
  }
  if (input.before.note !== input.after.note) {
    parts.push('비고 변경')
  }
  return parts.length ? parts.join('\n') : '주문 내용 수정'
}

export function buildItemChangeTitle(
  itemCategory: number | null | undefined,
  itemId: string,
) {
  const category = ([1, 2, 3, 4] as const).includes(itemCategory as ItemCategory)
    ? (itemCategory as ItemCategory)
    : null
  const label = category ? ITEM_CATEGORY_LABELS[category] : '품목'
  const id = itemId.trim()
  return id ? `${label} ${id}` : label
}

export type ItemChangePriceFields = {
  name: string
  unitPrice: number
  smdUnitPrice: number
  dipUnitPrice: number
  materialUnitPrice: number
  otherUnitPrice: number
}

function roundMoney(value: number) {
  return Math.round(Number(value) || 0)
}

function snapshotItemPrices(row: ItemChangePriceFields) {
  return {
    name: row.name,
    unitPrice: roundMoney(row.unitPrice),
    smdUnitPrice: roundMoney(row.smdUnitPrice),
    dipUnitPrice: roundMoney(row.dipUnitPrice),
    materialUnitPrice: roundMoney(row.materialUnitPrice),
    otherUnitPrice: roundMoney(row.otherUnitPrice),
  }
}

/** DB before_data / after_data용 — SMD·DIP·자재·기타·최종 단가 전후 + 어느 항목이 바뀌었는지 */
export function buildItemChangeDataPayload(input: {
  before: ItemChangePriceFields
  after: ItemChangePriceFields
}) {
  const moneyFields = [
    { key: 'smdUnitPrice' as const, label: 'SMD 단가' },
    { key: 'dipUnitPrice' as const, label: 'DIP 단가' },
    { key: 'materialUnitPrice' as const, label: '자재 단가' },
    { key: 'otherUnitPrice' as const, label: '기타 단가' },
    { key: 'unitPrice' as const, label: '최종 단가' },
  ]

  const priceChanges = moneyFields.flatMap((field) => {
    const before = roundMoney(input.before[field.key])
    const after = roundMoney(input.after[field.key])
    if (before === after) return []
    return [
      {
        field: field.key,
        label: field.label,
        before,
        after,
        direction: after > before ? ('up' as const) : ('down' as const),
      },
    ]
  })

  return {
    beforeData: snapshotItemPrices(input.before),
    afterData: {
      ...snapshotItemPrices(input.after),
      priceChanges,
    },
  }
}

export function buildItemChangeDetail(input: {
  before: ItemChangePriceFields
  after: ItemChangePriceFields
}) {
  const parts: string[] = []
  pushDiff(parts, '품목명', input.before.name, input.after.name)
  // SMD/DIP/자재는 DB JSON에 남기고, 화면용 detail에는 최종 단가만
  pushMoneyDiff(parts, '최종 단가', input.before.unitPrice, input.after.unitPrice)

  return parts.length ? parts.join('\n') : '품목 정보 수정'
}

export function buildQuoteChangeDetail(input: {
  before: {
    customer: string
    productName: string
    boardQty: number
    totalAmount: number
  }
  after: {
    customer: string
    productName: string
    boardQty: number
    totalAmount: number
  }
}) {
  const parts: string[] = []
  pushDiff(parts, '고객', input.before.customer, input.after.customer)
  pushDiff(parts, '제품', input.before.productName, input.after.productName)
  if (input.before.boardQty !== input.after.boardQty) {
    parts.push(
      `수량 ${input.before.boardQty.toLocaleString('ko-KR')} → ${input.after.boardQty.toLocaleString('ko-KR')}`,
    )
  }
  pushMoneyDiff(parts, '합계금액', input.before.totalAmount, input.after.totalAmount)
  return parts.length ? parts.join('\n') : '견적 내용 수정'
}

/** 주문 라인 단가 서명 — 수량만 바뀌면 동일 */
export function buildOrderUnitPriceSignature(
  lines: Array<{ productCode?: string; productId?: string | null; unitPrice: number }>,
) {
  return lines
    .map((line) => {
      const key = String(line.productId || line.productCode || '').trim()
      return `${key}::${Math.round(Number(line.unitPrice) || 0)}`
    })
    .sort()
    .join('|')
}

export function hasOrderUnitPriceChange(
  beforeLines: Array<{
    productCode?: string
    productId?: string | null
    unitPrice: number
    derivedFromLineId?: string | null
  }>,
  afterLines: Array<{ productCode?: string; productId?: string | null; unitPrice: number }>,
) {
  const before = beforeLines.filter((line) => !line.derivedFromLineId)
  return buildOrderUnitPriceSignature(before) !== buildOrderUnitPriceSignature(afterLines)
}

export function hasItemUnitPriceChange(
  before: {
    unitPrice: number
    smdUnitPrice: number
    dipUnitPrice: number
    materialUnitPrice: number
    otherUnitPrice: number
  },
  after: {
    unitPrice: number
    smdUnitPrice: number
    dipUnitPrice: number
    materialUnitPrice: number
    otherUnitPrice: number
  },
) {
  return (
    Math.round(before.unitPrice || 0) !== Math.round(after.unitPrice || 0) ||
    Math.round(before.smdUnitPrice || 0) !== Math.round(after.smdUnitPrice || 0) ||
    Math.round(before.dipUnitPrice || 0) !== Math.round(after.dipUnitPrice || 0) ||
    Math.round(before.materialUnitPrice || 0) !== Math.round(after.materialUnitPrice || 0) ||
    Math.round(before.otherUnitPrice || 0) !== Math.round(after.otherUnitPrice || 0)
  )
}

export function hasQuoteAmountChange(beforeTotal: number, afterTotal: number) {
  return Math.round(Number(beforeTotal) || 0) !== Math.round(Number(afterTotal) || 0)
}
