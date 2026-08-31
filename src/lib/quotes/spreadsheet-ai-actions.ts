'use server'

import { createSupabaseServerClient } from '@/lib/supabase/server'
import { inferSpreadsheetColumnsWithAi, isSpreadsheetAiConfigured } from '@/lib/quotes/spreadsheet-ai-client'
import { resolveBomColumnsFromAi, resolvePickPlaceColumnsFromAi } from '@/lib/quotes/spreadsheet-ai-resolve'
import type {
  InferSpreadsheetColumnsResult,
  SpreadsheetAiBomPayload,
  SpreadsheetAiFileKind,
  SpreadsheetAiPickPlacePayload,
} from '@/lib/quotes/spreadsheet-ai-types'

function sanitizePreviewRows(rows: string[][]) {
  return rows
    .slice(0, 15)
    .map((row) => row.slice(0, 30).map((cell) => String(cell ?? '').trim().slice(0, 120)))
    .filter((row) => row.some(Boolean))
}

export async function inferSpreadsheetColumnsAction(input: {
  fileKind: SpreadsheetAiFileKind
  fileName: string
  previewRows: string[][]
}): Promise<InferSpreadsheetColumnsResult> {
  if (!isSpreadsheetAiConfigured()) {
    return {
      ok: false,
      detail:
        'AI 컬럼 매핑이 설정되지 않았습니다. 서버에 OPENAI_API_KEY 또는 GEMINI_API_KEY를 추가해 주세요.',
    }
  }

  const supabase = await createSupabaseServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return { ok: false, detail: '로그인이 필요합니다.' }
  }

  const previewRows = sanitizePreviewRows(input.previewRows)
  if (!previewRows.length) {
    return { ok: false, detail: 'AI에 보낼 미리보기 행이 없습니다.' }
  }

  try {
    const raw = await inferSpreadsheetColumnsWithAi({
      fileKind: input.fileKind,
      fileName: input.fileName,
      previewRows,
    })

    if (input.fileKind === 'pickplace') {
      const payload = raw as SpreadsheetAiPickPlacePayload
      const resolved = resolvePickPlaceColumnsFromAi(previewRows, payload)
      if (!resolved) {
        return { ok: false, detail: 'AI가 제안한 좌표 컬럼을 확인하지 못했습니다.' }
      }
      return {
        ok: true,
        detection: {
          fileKind: 'pickplace',
          headerIndex: resolved.headerIndex,
          columns: resolved.columns,
          note: resolved.note,
        },
      }
    }

    const payload = raw as SpreadsheetAiBomPayload
    const resolved = resolveBomColumnsFromAi(previewRows, payload)
    if (!resolved) {
      return { ok: false, detail: 'AI가 제안한 BOM 컬럼을 확인하지 못했습니다.' }
    }
    return {
      ok: true,
      detection: {
        fileKind: 'bom',
        headerIndex: resolved.headerIndex,
        columns: resolved.columns,
        note: resolved.note,
      },
    }
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : 'AI 컬럼 매핑 중 오류가 발생했습니다.',
    }
  }
}
