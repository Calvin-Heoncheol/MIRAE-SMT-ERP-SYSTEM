import { inferSpreadsheetColumnsAction } from '@/lib/quotes/spreadsheet-ai-actions'
import type { AltiumBomAnalysis, AltiumBomParseResult } from '@/lib/quotes/parse-altium-bom'
import { parseBomRows } from '@/lib/quotes/parse-altium-bom'
import type { AltiumPickPlaceAnalysis, AltiumPickPlaceParseResult } from '@/lib/quotes/parse-altium-pick-place'
import { parsePickPlaceRows } from '@/lib/quotes/parse-altium-pick-place'
import type { SpreadsheetAiDetection } from '@/lib/quotes/spreadsheet-ai-types'

async function tryAiDetection(
  fileKind: 'pickplace' | 'bom',
  fileName: string,
  rows: string[][],
): Promise<SpreadsheetAiDetection | null> {
  const ai = await inferSpreadsheetColumnsAction({
    fileKind,
    fileName,
    previewRows: rows,
  })
  return ai.ok ? ai.detection : null
}

function bomParseMetaRatio(analysis: AltiumBomAnalysis) {
  if (!analysis.lines.length) return 0
  const withMeta = analysis.lines.filter(
    (line) => line.comment || line.footprint || line.description || line.mpn,
  ).length
  return withMeta / analysis.lines.length
}

function pickPlaceParseMetaRatio(analysis: AltiumPickPlaceAnalysis) {
  const rows = analysis.classifiedRows.filter((row) => row.category !== 'skip')
  if (!rows.length) return 0
  const withMeta = rows.filter(
    (row) => row.package.trim() || row.description.trim() || row.value.trim(),
  ).length
  return withMeta / rows.length
}

export async function parsePickPlaceRowsWithAiFallback(
  rows: string[][],
  fileName: string,
): Promise<AltiumPickPlaceParseResult> {
  const rulesResult = parsePickPlaceRows(rows, fileName)

  const detection = await tryAiDetection('pickplace', fileName, rows)
  if (!detection || detection.fileKind !== 'pickplace') {
    return rulesResult
  }

  const aiResult = parsePickPlaceRows(rows, fileName, {
    forcedDetection: {
      headerIndex: detection.headerIndex,
      columns: detection.columns,
      note: detection.note,
    },
  })

  if (aiResult.ok && rulesResult.ok) {
    const aiMeta = pickPlaceParseMetaRatio(aiResult.analysis)
    const rulesMeta = pickPlaceParseMetaRatio(rulesResult.analysis)
    if (rulesMeta > aiMeta + 0.15) return rulesResult
    return aiResult
  }

  if (aiResult.ok) return aiResult

  if (rulesResult.ok) return rulesResult

  return {
    ok: false,
    detail: `${rulesResult.detail}\n\nAI 컬럼 매핑을 시도했지만 분석에 실패했습니다.`,
  }
}

export async function parseBomRowsWithAiFallback(
  rows: string[][],
  fileName: string,
  options?: { struckRows?: Set<number> },
): Promise<AltiumBomParseResult> {
  const rulesResult = parseBomRows(rows, fileName, options)

  const detection = await tryAiDetection('bom', fileName, rows)
  if (!detection || detection.fileKind !== 'bom') {
    return rulesResult
  }

  const aiResult = parseBomRows(rows, fileName, {
    forcedDetection: {
      headerIndex: detection.headerIndex,
      columns: detection.columns,
      note: detection.note,
    },
    struckRows: options?.struckRows,
  })

  if (aiResult.ok && rulesResult.ok) {
    const aiMeta = bomParseMetaRatio(aiResult.analysis)
    const rulesMeta = bomParseMetaRatio(rulesResult.analysis)
    if (rulesMeta > aiMeta + 0.15) return rulesResult
    return aiResult
  }

  if (aiResult.ok) return aiResult

  if (rulesResult.ok) return rulesResult

  return {
    ok: false,
    detail: `${rulesResult.detail}\n\nAI 컬럼 매핑을 시도했지만 분석에 실패했습니다.`,
  }
}
