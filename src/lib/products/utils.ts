import type { Product, ProductKind, ProductPcbSideMode, ProductProcessType } from './types'
import { deriveItemProcessType } from '@/lib/items/types'
import { normalizeVersionLabel, parseItemVersionCode } from '@/lib/items/version-code'

export function normalizeProductKind(value: string | null | undefined): ProductKind {
  return String(value || '').trim().toLowerCase() === 'assembly' ? 'assembly' : 'pcb'
}

export function normalizeProductPcbSideMode(value: string | null | undefined): ProductPcbSideMode {
  const mode = String(value || '').trim().toLowerCase()
  if (mode === 'duo') return 'duo'
  // 레거시 dual = 양면 → double
  if (mode === 'double' || mode === 'dual') return 'double'
  return 'single'
}

export function normalizeProductProcessType(value: string | null | undefined): ProductProcessType {
  const raw = String(value || '').trim().toLowerCase().replace(/\s+/g, '')
  if (raw === 'smt' || raw === 'smd') return 'smt'
  if (raw === 'post' || raw === '후공정') return 'post'
  if (
    raw === 'smt_post' ||
    raw === 'smd_post' ||
    raw === 'smt+post' ||
    raw === 'smd+post' ||
    raw === 'smd+후공정' ||
    raw === 'smt+후공정'
  ) {
    return 'smt_post'
  }
  return ''
}

export function formatProductPcbSideModeLabel(mode: ProductPcbSideMode) {
  if (mode === 'double') return '양면'
  if (mode === 'duo') return '더블'
  return '단면'
}

export function isSplitProductPcbSideMode(mode: ProductPcbSideMode | string | null | undefined) {
  return mode === 'double'
}

export function mapProductRecord(row: {
  id: string
  customer: string | null
  product_name: string
  default_unit_price: number | null
  pcb_side_mode?: string | null
  process_type?: string | null
  product_kind?: string | null
  is_active: boolean | null
}): Product {
  const parsed = parseItemVersionCode(row.id)
  return {
    id: row.id,
    customer: row.customer || '',
    productCode: parsed.base || row.id,
    version: normalizeVersionLabel(parsed.version || ''),
    productName: row.product_name || '',
    defaultUnitPrice: Number(row.default_unit_price) || 0,
    pcbSideMode: normalizeProductPcbSideMode(row.pcb_side_mode),
    processType: normalizeProductProcessType(row.process_type),
    productKind: normalizeProductKind(row.product_kind),
    isActive: row.is_active !== false,
  }
}

export function mapItemRowToProduct(row: {
  id: string
  base_code?: string | null
  version?: string | null
  name: string
  specification?: string | null
  mpn?: string | null
  pcb_side_mode?: string | null
  process_type?: string | null
  unit_price?: number | null
  smd_unit_price?: number | null
  dip_unit_price?: number | null
  material_unit_price?: number | null
  other_unit_price?: number | null
  item_category: number | string
  is_active: boolean | null
}): Product {
  const itemCategory = Number(row.item_category)
  const parsed = parseItemVersionCode(row.id)
  const baseCode = String(row.base_code || '').trim() || parsed.base || row.id
  const version = normalizeVersionLabel(row.version || parsed.version || '')

  let processType: ProductProcessType = ''
  const smdUnitPrice = Number(row.smd_unit_price) || 0
  const dipUnitPrice = Number(row.dip_unit_price) || 0
  const materialUnitPrice = Number(row.material_unit_price) || 0
  const otherUnitPrice = Number(row.other_unit_price) || 0
  const unitPrice = Number(row.unit_price) || 0
  const breakdownTotal = smdUnitPrice + dipUnitPrice + materialUnitPrice + otherUnitPrice

  if (itemCategory === 3 || itemCategory === 4) {
    processType = normalizeProductProcessType(row.process_type)
    if (!processType) {
      processType = deriveItemProcessType(smdUnitPrice, dipUnitPrice)
    }
  }

  return {
    id: row.id,
    customer: '',
    productCode: baseCode,
    version,
    productName: row.name || '',
    defaultUnitPrice: unitPrice > 0 ? unitPrice : breakdownTotal,
    pcbSideMode: normalizeProductPcbSideMode(row.pcb_side_mode),
    processType,
    productKind: itemCategory === 4 ? 'assembly' : 'pcb',
    isActive: row.is_active !== false,
  }
}

export function normalizeSearchText(value: string) {
  return value.trim().toLowerCase()
}

export function productMatchesCustomer(product: Product, customer: string) {
  const orderCustomer = customer.trim()
  if (!orderCustomer) return true
  const productCustomer = product.customer.trim()
  if (!productCustomer) return true
  return productCustomer === orderCustomer
}

export function productSearchHaystack(product: Product) {
  return [product.productCode, product.version, product.productName, product.customer, product.id]
    .join(' ')
    .toLowerCase()
}

export function filterProductsForOrder(products: Product[], customer: string, query: string) {
  const q = normalizeSearchText(query)
  return products.filter((product) => {
    if (!product.isActive) return false
    if (!productMatchesCustomer(product, customer)) return false
    if (!q) return true
    return productSearchHaystack(product).includes(q)
  })
}

export function findProductsByCode(products: Product[], code: string, customer: string) {
  const want = code.trim()
  if (!want) return [] as Product[]
  const active = products.filter(
    (product) => product.isActive && productMatchesCustomer(product, customer),
  )
  const byId = active.find((product) => product.id === want)
  if (byId) return [byId]

  return active.filter(
    (product) =>
      product.productCode === want || product.productCode.toUpperCase() === want.toUpperCase(),
  )
}

export function findProductByCode(products: Product[], code: string, customer: string) {
  const matches = findProductsByCode(products, code, customer)
  return matches.length === 1 ? matches[0] : null
}

export function findProductById(products: Product[], id: string) {
  const want = id.trim()
  if (!want) return null
  return products.find((product) => product.isActive && product.id === want) ?? null
}

export function findProductsByName(products: Product[], name: string, customer: string) {
  const want = name.trim()
  if (!want) return [] as Product[]
  return products.filter(
    (product) =>
      product.isActive &&
      productMatchesCustomer(product, customer) &&
      product.productName === want,
  )
}

export function findProductByName(products: Product[], name: string, customer: string) {
  const matches = findProductsByName(products, name, customer)
  return matches.length === 1 ? matches[0] : null
}

/** 주문 라인 제품명이 마스터와 일치하는지 확인하고 연결된 제품을 반환 */
export function resolveOrderLineProduct(
  products: Product[],
  customer: string,
  line: { productId: string | null; productName: string },
): Product | null {
  const productName = line.productName.trim()
  if (!productName) return null

  const productId = line.productId?.trim() || ''
  if (productId) {
    const byId = findProductById(products, productId)
    if (!byId) return null
    if (!productMatchesCustomer(byId, customer)) return null
    if (byId.productName !== productName) return null
    return byId
  }

  return findProductByName(products, productName, customer)
}

export type ProductInputResolveResult =
  | { status: 'resolved'; product: Product }
  | { status: 'ambiguous'; products: Product[] }
  | { status: 'none' }

/**
 * 제품코드/제품명 입력 확정.
 * - 일치 품목이 1개(버전 없음 포함)면 자동 확정
 * - 같은 코드·이름에 버전이 2개 이상이면 ambiguous (드롭다운 선택 필요)
 */
export function resolveProductInput(
  products: Product[],
  customer: string,
  codeRaw: string,
  nameRaw: string,
): ProductInputResolveResult {
  const code = codeRaw.trim()
  const name = nameRaw.trim()

  if (code) {
    const byCode = findProductsByCode(products, code, customer)
    if (byCode.length === 1) return { status: 'resolved', product: byCode[0] }
    if (byCode.length > 1) return { status: 'ambiguous', products: byCode }
  }

  if (name) {
    const byName = findProductsByName(products, name, customer)
    if (byName.length === 1) return { status: 'resolved', product: byName[0] }
    if (byName.length > 1) return { status: 'ambiguous', products: byName }
  }

  return { status: 'none' }
}

export function resolveProductFromInput(
  products: Product[],
  customer: string,
  codeRaw: string,
  nameRaw: string,
): Product | null {
  const result = resolveProductInput(products, customer, codeRaw, nameRaw)
  return result.status === 'resolved' ? result.product : null
}

export function formatProductOptionLabel(product: Product) {
  const name = product.productName || product.productCode
  if (product.version) return `${name} (${product.version})`
  return name
}

/** 버전 선택용 — 버전 유무를 분명히 표시 */
export function formatProductVersionChoiceLabel(product: Product) {
  const code = product.productCode || product.id
  const name = product.productName || '—'
  const version = product.version.trim() || '버전 없음'
  return `${code} · ${name} · ${version}`
}

export function isAutoGeneratedProductCode(code: string) {
  return /^MRP-\d+$/.test(code.trim())
}
