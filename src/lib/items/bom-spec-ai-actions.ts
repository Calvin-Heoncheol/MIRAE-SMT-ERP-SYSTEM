'use server'

import { inferBomSpecSplitsWithAi } from '@/lib/items/bom-spec-ai-client'
import type {
  BomSpecAiRowInput,
  BomSpecAiSplit,
  SplitBomSpecsResult,
} from '@/lib/items/bom-spec-ai-types'
import { isSpreadsheetAiConfigured } from '@/lib/quotes/spreadsheet-ai-client'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const AI_BATCH_SIZE = 25
const MAX_ROWS_TOTAL = 300

function sanitizeRow(row: BomSpecAiRowInput): BomSpecAiRowInput {
  return {
    code: String(row.code ?? '').trim().slice(0, 80),
    name: String(row.name ?? '').trim().slice(0, 160),
    specification: String(row.specification ?? '').trim().slice(0, 320),
    package: String(row.package ?? '').trim().slice(0, 80),
    mpn: String(row.mpn ?? '').trim().slice(0, 120),
    materialType: row.materialType === 'SMD' || row.materialType === 'DIP' ? row.materialType : '',
  }
}

export async function splitBomSpecsWithAiAction(input: {
  rows: BomSpecAiRowInput[]
}): Promise<SplitBomSpecsResult> {
  if (!isSpreadsheetAiConfigured()) {
    return {
      ok: false,
      detail:
        'AI 분리가 설정되지 않았습니다. 서버에 OPENAI_API_KEY 또는 GEMINI_API_KEY를 추가해 주세요.',
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, detail: '로그인이 필요합니다.' }
  }

  const rows = input.rows.map(sanitizeRow).filter((row) => row.code && row.specification)
  if (!rows.length) {
    return { ok: false, detail: '분리할 사양 행이 없습니다. (패키지·MPN이 비고 사양이 섞인 행만 대상)' }
  }
  if (rows.length > MAX_ROWS_TOTAL) {
    return {
      ok: false,
      detail: `한 번에 최대 ${MAX_ROWS_TOTAL}건까지 AI 분리할 수 있습니다.`,
    }
  }

  try {
    const splits: BomSpecAiSplit[] = []
    for (let index = 0; index < rows.length; index += AI_BATCH_SIZE) {
      const batch = rows.slice(index, index + AI_BATCH_SIZE)
      const batchResult = await inferBomSpecSplitsWithAi(batch)
      splits.push(...batchResult)
    }
    if (!splits.length) {
      return { ok: false, detail: 'AI가 분리 결과를 반환하지 못했습니다.' }
    }
    return { ok: true, splits, processedCount: rows.length }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'AI 사양 분리 중 오류가 발생했습니다.',
    }
  }
}
