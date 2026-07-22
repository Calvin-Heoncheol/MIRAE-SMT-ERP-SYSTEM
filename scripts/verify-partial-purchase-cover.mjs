/**
 * 부분 발주 커버/잔량 계산 계약 검증
 * 실행: node scripts/verify-partial-purchase-cover.mjs
 */

function buildCoveredQuantityByOrderLine(purchaseOrders) {
  const covered = new Map()
  for (const po of purchaseOrders) {
    const lineId = (po.coveredOrderLineId || '').trim().toLowerCase()
    const qty = Math.max(0, Math.floor(Number(po.coveredProductQuantity) || 0))
    if (!lineId || qty <= 0) continue
    covered.set(lineId, (covered.get(lineId) ?? 0) + qty)
  }
  return covered
}

function lineRemaining(orderQuantity, coveredQty) {
  const orderQty = Math.max(0, Math.floor(orderQuantity))
  const coveredQuantity = Math.min(orderQty, Math.max(0, Math.floor(coveredQty)))
  return {
    coveredQuantity,
    remainingQuantity: Math.max(0, orderQty - coveredQuantity),
  }
}

function cardHasOpenPurchase(products) {
  return products.some((p) => p.hasBom && p.remainingQuantity > 0)
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg)
}

const lineId = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'
const covered = buildCoveredQuantityByOrderLine([
  { coveredOrderLineId: lineId.toUpperCase(), coveredProductQuantity: 100 },
])
const { coveredQuantity, remainingQuantity } = lineRemaining(4000, covered.get(lineId) ?? 0)

assert(coveredQuantity === 100, `expected covered 100, got ${coveredQuantity}`)
assert(remainingQuantity === 3900, `expected remaining 3900, got ${remainingQuantity}`)
assert(
  cardHasOpenPurchase([{ hasBom: true, remainingQuantity }]),
  'partial purchase must stay in active filter',
)

const full = lineRemaining(4000, 4000)
assert(full.remainingQuantity === 0, 'full cover remaining must be 0')
assert(
  !cardHasOpenPurchase([{ hasBom: true, remainingQuantity: full.remainingQuantity }]),
  'full cover must leave active filter',
)

const missingQty = buildCoveredQuantityByOrderLine([
  { coveredOrderLineId: lineId, coveredProductQuantity: null },
])
assert((missingQty.get(lineId) ?? 0) === 0, 'null cover qty must not count as full cover')

console.log('verify-partial-purchase-cover: ok')
