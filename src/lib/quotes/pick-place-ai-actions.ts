'use server'

import { inferPickPlaceClassificationsWithAi } from '@/lib/quotes/pick-place-ai-client'
import type {
  ClassifyPickPlaceRowsResult,
  PickPlaceAiRowInput,
} from '@/lib/quotes/pick-place-ai-types'
import { isSpreadsheetAiConfigured } from '@/lib/quotes/spreadsheet-ai-client'
import { createSupabaseServerClient } from '@/lib/supabase/server'

const AI_BATCH_SIZE = 20
const MAX_ROWS_TOTAL = 200

function sanitizeRow(row: PickPlaceAiRowInput): PickPlaceAiRowInput {
  return {
    designator: String(row.designator ?? '').trim().slice(0, 40),
    side: row.side,
    package: String(row.package ?? '').trim().slice(0, 120),
    value: String(row.value ?? '').trim().slice(0, 120),
    description: String(row.description ?? '').trim().slice(0, 160),
    currentCategory: row.currentCategory,
    currentDetail: String(row.currentDetail ?? '').trim().slice(0, 160),
  }
}

export async function classifyPickPlaceRowsAction(input: {
  rows: PickPlaceAiRowInput[]
}): Promise<ClassifyPickPlaceRowsResult> {
  if (!isSpreadsheetAiConfigured()) {
    return {
      ok: false,
      detail:
        'AI 검토가 설정되지 않았습니다. 서버에 OPENAI_API_KEY 또는 GEMINI_API_KEY를 추가해 주세요.',
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, detail: '로그인이 필요합니다.' }
  }

  const rows = input.rows.map(sanitizeRow).filter((row) => row.designator)
  if (!rows.length) {
    return { ok: false, detail: 'AI에 보낼 검토 항목이 없습니다.' }
  }
  if (rows.length > MAX_ROWS_TOTAL) {
    return {
      ok: false,
      detail: `한 번에 최대 ${MAX_ROWS_TOTAL}건까지 AI 검토할 수 있습니다. 검토 필요만 남기고 다시 시도해 주세요.`,
    }
  }

  try {
    const classifications: Awaited<ReturnType<typeof inferPickPlaceClassificationsWithAi>> = []
    for (let index = 0; index < rows.length; index += AI_BATCH_SIZE) {
      const batch = rows.slice(index, index + AI_BATCH_SIZE)
      const batchResult = await inferPickPlaceClassificationsWithAi(batch)
      classifications.push(...batchResult)
    }
    if (!classifications.length) {
      return { ok: false, detail: 'AI가 분류 결과를 반환하지 못했습니다.' }
    }
    return { ok: true, classifications }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'AI 검토 중 오류가 발생했습니다.',
    }
  }
}
