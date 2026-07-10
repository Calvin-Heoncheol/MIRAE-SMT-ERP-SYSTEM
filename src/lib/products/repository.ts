import { createSupabaseClient } from '@/lib/supabase'
import type { Product, ProductPayload } from './types'
import { mapItemRowToProduct } from './utils'

export type FetchProductsResult =
  | { ok: true; products: Product[] }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveProductResult =
  | { ok: true; id: string; productCode: string }
  | { ok: false; reason: 'env' | 'query'; detail: string }

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

    return { ok: true, products: (data || []).map((row) => mapItemRowToProduct(row)) }
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

  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from('items')
      .insert({
        id: payload.productName.trim(),
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

    return { ok: true, id: data.id, productCode: data.id }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
