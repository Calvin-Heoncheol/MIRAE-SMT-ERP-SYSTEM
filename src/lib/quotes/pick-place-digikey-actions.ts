'use server'

import { classifyPickPlaceFromDigiKeyProduct } from '@/lib/quotes/digikey-classify'
import { isDigiKeyConfigured, searchDigiKeyProductByMpn } from '@/lib/quotes/digikey-client'
import type {
  ClassifyPickPlaceWithDigiKeyResult,
  PickPlaceDigiKeyClassification,
  PickPlaceDigiKeyRowInput,
} from '@/lib/quotes/digikey-types'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const MAX_ROWS_TOTAL = 50
const REQUEST_GAP_MS = 120

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function sanitizeRow(row: PickPlaceDigiKeyRowInput): PickPlaceDigiKeyRowInput | null {
  const mpn = String(row.mpn ?? '').trim()
  if (!mpn) return null
  return {
    designator: String(row.designator ?? '').trim().slice(0, 40),
    mpn: mpn.slice(0, 80),
    manufacturer: String(row.manufacturer ?? '').trim().slice(0, 80) || undefined,
    package: String(row.package ?? '').trim().slice(0, 120),
    value: String(row.value ?? '').trim().slice(0, 120),
    description: String(row.description ?? '').trim().slice(0, 160),
    currentCategory: row.currentCategory,
  }
}

export async function classifyPickPlaceRowsWithDigiKeyAction(input: {
  rows: PickPlaceDigiKeyRowInput[]
}): Promise<ClassifyPickPlaceWithDigiKeyResult> {
  if (!isDigiKeyConfigured()) {
    return {
      ok: false,
      detail:
        'DigiKey API가 설정되지 않았습니다. 서버에 DIGIKEY_CLIENT_ID, DIGIKEY_CLIENT_SECRET을 추가해 주세요.',
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, detail: '로그인이 필요합니다.' }
  }

  const rows = input.rows.map(sanitizeRow).filter((row): row is PickPlaceDigiKeyRowInput => Boolean(row))
  if (!rows.length) {
    return { ok: false, detail: 'MPN이 있는 검토 항목이 없습니다.' }
  }
  if (rows.length > MAX_ROWS_TOTAL) {
    return {
      ok: false,
      detail: `한 번에 최대 ${MAX_ROWS_TOTAL}건까지 DigiKey 조회할 수 있습니다.`,
    }
  }

  const classifications: PickPlaceDigiKeyClassification[] = []
  const skipped: string[] = []
  const mpnCache = new Map<string, Awaited<ReturnType<typeof searchDigiKeyProductByMpn>>>()

  try {
    for (const [index, row] of rows.entries()) {
      if (index > 0) await sleep(REQUEST_GAP_MS)

      const cacheKey = `${row.mpn.toUpperCase()}|${row.manufacturer?.toUpperCase() ?? ''}`
      let product = mpnCache.get(cacheKey)
      if (product === undefined) {
        product = await searchDigiKeyProductByMpn({
          mpn: row.mpn,
          manufacturer: row.manufacturer,
        })
        mpnCache.set(cacheKey, product)
      }

      if (!product) {
        skipped.push(`${row.designator} (${row.mpn})`)
        continue
      }

      classifications.push(
        classifyPickPlaceFromDigiKeyProduct({
          designator: row.designator,
          mpn: row.mpn,
          product,
        }),
      )
    }

    if (!classifications.length) {
      return {
        ok: false,
        detail: 'DigiKey에서 일치하는 부품을 찾지 못했습니다. MPN을 확인해 주세요.',
      }
    }

    return { ok: true, classifications, skipped }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'DigiKey 조회 중 오류가 발생했습니다.',
    }
  }
}
