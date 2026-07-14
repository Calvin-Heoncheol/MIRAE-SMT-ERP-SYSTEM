import type { Product, ProductKind, ProductPcbSideMode, ProductProcessType } from './types'

export function normalizeProductKind(value: string | null | undefined): ProductKind {
  return String(value || '').trim().toLowerCase() === 'assembly' ? 'assembly' : 'pcb'
}

export function normalizeProductPcbSideMode(value: string | null | undefined): ProductPcbSideMode {
  const mode = String(value || '').trim().toLowerCase()
  return mode === 'dual' ? 'dual' : 'single'
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
  return mode === 'dual' ? '양면' : '단면'
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
  return {
    id: row.id,
    customer: row.customer || '',
    productCode: row.id,
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
  name: string
  specification?: string | null
  mpn?: string | null
  pcb_side_mode?: string | null
  process_type?: string | null
  unit_price?: number | null
  item_category: number | string
  is_active: boolean | null
}): Product {
  const itemCategory = Number(row.item_category)
  return {
    id: row.id,
    customer: '',
    productCode: row.id,
    productName: row.name || '',
    defaultUnitPrice: Number(row.unit_price) || 0,
    pcbSideMode: normalizeProductPcbSideMode(row.pcb_side_mode),
    processType: itemCategory === 3 ? normalizeProductProcessType(row.process_type) : '',
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
  return [product.productCode, product.productName, product.customer].join(' ').toLowerCase()
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

export function findProductByCode(products: Product[], code: string, customer: string) {
  const want = code.trim()
  if (!want) return null
  return (
    products.find(
      (product) =>
        product.isActive && product.id === want && productMatchesCustomer(product, customer),
    ) ?? null
  )
}

export function findProductById(products: Product[], id: string) {
  const want = id.trim()
  if (!want) return null
  return products.find((product) => product.isActive && product.id === want) ?? null
}

export function findProductByName(products: Product[], name: string, customer: string) {
  const want = name.trim()
  if (!want) return null
  const matches = products.filter(
    (product) =>
      product.isActive &&
      productMatchesCustomer(product, customer) &&
      product.productName === want,
  )
  if (matches.length === 1) return matches[0]
  return null
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

export function resolveProductFromInput(
  products: Product[],
  customer: string,
  codeRaw: string,
  nameRaw: string,
): Product | null {
  const code = codeRaw.trim()
  const name = nameRaw.trim()

  if (code) {
    const byCode = findProductByCode(products, code, customer)
    if (byCode) return byCode
  }

  if (name) {
    const byName = findProductByName(products, name, customer)
    if (byName) return byName
  }

  return null
}

export function formatProductOptionLabel(product: Product) {
  return product.productName || product.productCode
}

export function isAutoGeneratedProductCode(code: string) {
  return /^MRP-\d+$/.test(code.trim())
}
