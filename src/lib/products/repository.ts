import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { createSupabaseClient } from '@/lib/supabase'
import type { Product, ProductPayload } from './types'
import { mapItemRowToProduct } from './utils'

export type FetchProductsResult =
  | { ok: true; products: Product[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveProductResult =
  | { ok: true; id: string; productCode: string }
  | { ok: false; reason: 'env' | 'query' | 'auth'; detail: string }

export function isMissingProductsTable(detail: string) {
  return detail.includes('items') || detail.includes('products') || detail.includes('schema cache')
}

function missingEnvResult(): { ok: false; reason: 'env'; detail: string } {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  }
}

async function attachProductCustomerNames(
  supabase: ReturnType<typeof createSupabaseClient>,
  products: Product[],
  rows: Array<{ customer_id?: string | null; customer_name?: string | null }>,
): Promise<Product[]> {
  const ids = [...new Set(rows.map((row) => String(row.customer_id || '').trim()).filter(Boolean))]
  if (!ids.length) return products

  const names = new Map<string, string>()
  const chunkSize = 100
  for (let offset = 0; offset < ids.length; offset += chunkSize) {
    const chunk = ids.slice(offset, offset + chunkSize)
    const { data, error } = await supabase
      .from('business_partners')
      .select('id, name')
      .in('id', chunk)
    if (error) break
    for (const row of data || []) {
      const id = String(row.id || '').trim()
      if (id) names.set(id, String(row.name || '').trim())
    }
  }

  return products.map((product, index) => {
    const source = rows[index]
    const customerId = String(source?.customer_id || '').trim()
    const customerName =
      (customerId ? names.get(customerId) : '') || String(source?.customer_name || '').trim()
    return customerName ? { ...product, customer: customerName } : product
  })
}

export async function fetchProducts(activeOnly = true): Promise<FetchProductsResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()
    let query = supabase
      .from('items')
      .select('*')
      .in('item_category', [3, 4])
      .order('name', { ascending: true })

    if (activeOnly) {
      query = query.eq('is_active', true)
    }

    const { data, error } = await query

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    const rows = data || []
    const products = rows.map((row) => mapItemRowToProduct(row))
    return {
      ok: true,
      products: await attachProductCustomerNames(supabase, products, rows),
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export async function createProduct(payload: ProductPayload): Promise<SaveProductResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  const gate = await assertCanWrite({ module: 'master', action: 'create' })
  if (!gate.ok) return gate

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('items')
      .insert({
        base_code: payload.productName.trim(),
        version: '',
        name: payload.productName.trim(),
        specification: '',
        mpn: '',
        item_category: payload.productKind === 'assembly' ? 4 : 3,
        is_active: payload.isActive !== false,
      })
      .select('id')
      .single()

    if (error) {
      return { ok: false, reason: 'query', detail: error.message }
    }

    return { ok: true, id: data.id, productCode: payload.productName.trim() || data.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
