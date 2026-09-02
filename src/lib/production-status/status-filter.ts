import type { ProductionStatusLine, ProductionStatusProductLine } from '@/lib/production-status/types'

export type ProductionStatusFilter = 'producing' | 'production_done' | 'delivery_done' | 'all'

export type ProductionStatusBucket = 'producing' | 'production_done' | 'delivery_done' | 'none'

type ProductionQuantities = {
  smtTarget: number
  smtProduced: number
  postTarget: number
  postProduced: number
}

type DeliveryQuantities = {
  deliveryTarget: number
  deliveryProduced: number
}

/** 생산(SMT·후공정) 목표가 있는 행만 생산 진행 판정 대상 */
export function hasProductionStatusTarget(input: { smtTarget: number; postTarget: number }) {
  return input.smtTarget > 0 || input.postTarget > 0
}

/** 생산(SMT·후공정) 목표 대비 완료 */
export function isProductionStatusProductionComplete(input: ProductionQuantities) {
  const hasSmt = input.smtTarget > 0
  const hasPost = input.postTarget > 0
  if (!hasSmt && !hasPost) return false
  const smtDone = !hasSmt || input.smtProduced >= input.smtTarget
  const postDone = !hasPost || input.postProduced >= input.postTarget
  return smtDone && postDone
}

/** 발주 잔량 기준 출하 완료 */
export function isProductionStatusDeliveryComplete(input: DeliveryQuantities) {
  return input.deliveryTarget > 0 && input.deliveryProduced >= input.deliveryTarget
}

export function classifyProductionStatusProduct(
  product: ProductionStatusProductLine,
): ProductionStatusBucket {
  if (isProductionStatusDeliveryComplete(product)) return 'delivery_done'

  const hasProduction =
    hasProductionStatusTarget(product) || product.smtChildren.length > 0
  if (hasProduction) {
    if (isProductionStatusProductionComplete(product)) return 'production_done'
    return 'producing'
  }

  return 'none'
}

export function classifyProductionStatusRow(
  row: ProductionQuantities & DeliveryQuantities & { smtChildrenCount?: number },
): ProductionStatusBucket {
  if (isProductionStatusDeliveryComplete(row)) return 'delivery_done'

  const hasProduction =
    hasProductionStatusTarget(row) || (row.smtChildrenCount ?? 0) > 0
  if (hasProduction) {
    if (isProductionStatusProductionComplete(row)) return 'production_done'
    return 'producing'
  }

  return 'none'
}

export function productMatchesProductionStatusFilter(
  product: ProductionStatusProductLine,
  filter: ProductionStatusFilter,
): boolean {
  if (filter === 'all') return true
  return classifyProductionStatusProduct(product) === filter
}

/**
 * 필터 칩용 — 제품 행만 남긴다.
 * - 생산 진행중: 생산 미완료
 * - 생산 완료: 생산 완료 + 출하 잔량
 * - 출하완료: 출하 목표 달성
 * - 생산 대상 없음(출하만): 전체·출하완료에만 포함
 */
export function filterProductionStatusLineByStatus(
  line: ProductionStatusLine,
  statusFilter: ProductionStatusFilter,
): ProductionStatusLine | null {
  if (statusFilter === 'all') return line

  if (line.products.length === 0) {
    const bucket = classifyProductionStatusRow(line)
    return bucket === statusFilter ? line : null
  }

  const products = line.products.filter((product) =>
    productMatchesProductionStatusFilter(product, statusFilter),
  )
  if (!products.length) return null

  return {
    ...line,
    products,
    productCount: products.length,
    productName: products.map((product) => product.productName).filter(Boolean).join(', ') || line.productName,
  }
}

/** 출하 등록 후보 — 출하완료가 아닌 진행 발주 */
export function isProductionStatusProductEligibleForDeliveryRegister(
  product: ProductionStatusProductLine,
) {
  if (!product.assemblyGroupIds.some((id) => id.trim())) return false
  if (classifyProductionStatusProduct(product) === 'delivery_done') return false
  if (!hasProductionStatusTarget(product) && product.smtChildren.length === 0) {
    return product.deliveryTarget > 0
  }
  return true
}

export function collectActiveDeliveryAssemblyGroupIds(lines: ProductionStatusLine[]) {
  const ids = new Set<string>()
  for (const line of lines) {
    if (line.products.length === 0) continue
    for (const product of line.products) {
      if (!isProductionStatusProductEligibleForDeliveryRegister(product)) continue
      for (const id of product.assemblyGroupIds) {
        const trimmed = id.trim()
        if (trimmed) ids.add(trimmed)
      }
    }
  }
  return ids
}

/** @deprecated filter·뱃지와 동일 — 생산(SMT·후공정) 완료만 */
export function isProductionStatusLineProductionComplete(line: ProductionStatusLine) {
  if (line.products.length > 0) {
    const targets = line.products.filter(
      (product) => hasProductionStatusTarget(product) || product.smtChildren.length > 0,
    )
    if (!targets.length) return isProductionStatusProductionComplete(line)
    return targets.every((product) => isProductionStatusProductionComplete(product))
  }
  return isProductionStatusProductionComplete(line)
}
