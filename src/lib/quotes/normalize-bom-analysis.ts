import { splitBomSpecsWithAiAction } from '@/lib/items/bom-spec-ai-actions'
import type { BomSpecAiRowInput } from '@/lib/items/bom-spec-ai-types'
import {
  applyRuleBomSpecNormalize,
  bomLineNeedsSpecNormalize,
} from '@/lib/quotes/normalize-bom-spec'
import type { AltiumBomAnalysis, BomLine } from '@/lib/quotes/parse-altium-bom'
import { designatorLookupKeys } from '@/lib/quotes/designator-utils'

function rebuildDesignatorIndex(lines: BomLine[]) {
  const designatorIndex: Record<string, BomLine> = {}
  for (const line of lines) {
    for (const designator of line.designators) {
      for (const key of designatorLookupKeys(designator)) {
        if (!designatorIndex[key]) designatorIndex[key] = line
      }
    }
  }
  return designatorIndex
}

function lineAiCode(line: BomLine) {
  const cpn = line.customerPartNo?.trim()
  if (cpn) return cpn
  return `L${line.lineIndex}`
}

function toAiRow(line: BomLine): BomSpecAiRowInput | null {
  if (!bomLineNeedsSpecNormalize(line)) return null
  const specification = (line.comment || line.description).trim()
  if (!specification) return null
  return {
    code: lineAiCode(line),
    name: line.description.trim() || line.designatorsRaw,
    specification,
    package: line.footprint.trim(),
    mpn: line.mpn.trim(),
    materialType: '',
  }
}

function applyAiSplitToLine(
  line: BomLine,
  split: { specification: string; package: string; mpn: string; reason: string },
): BomLine {
  return {
    ...line,
    comment: split.specification.trim() || line.comment,
    footprint: split.package.trim() || line.footprint,
    mpn: split.mpn.trim() || line.mpn,
    normalizeNote: split.reason || 'AI 사양 분리',
    normalizeSource: 'ai',
  }
}

/** 규칙으로 1차 정규화 (동기) */
export function normalizeBomAnalysisWithRules(analysis: AltiumBomAnalysis): AltiumBomAnalysis {
  const lines = analysis.lines.map(applyRuleBomSpecNormalize)
  const normalizedCount = lines.filter((line) => line.normalizeSource === 'rules').length
  const warnings = [...analysis.summary.warnings]
  if (normalizedCount > 0) {
    warnings.push(`BOM 사양 정규화(규칙) ${normalizedCount}건 — Specification에서 Package/MPN 분리`)
  }
  return {
    ...analysis,
    lines,
    designatorIndex: rebuildDesignatorIndex(lines),
    summary: {
      ...analysis.summary,
      warnings,
    },
  }
}

/**
 * 규칙 정규화 후, 남는 혼재 사양은 AI로 추가 분리.
 * API 키 없으면 규칙 결과만 반환.
 */
export async function normalizeBomAnalysisWithAi(
  analysis: AltiumBomAnalysis,
): Promise<AltiumBomAnalysis> {
  const ruled = normalizeBomAnalysisWithRules(analysis)
  const aiTargets = ruled.lines.map(toAiRow).filter((row): row is BomSpecAiRowInput => Boolean(row))
  if (!aiTargets.length) return ruled

  const ai = await splitBomSpecsWithAiAction({ rows: aiTargets })
  if (!ai.ok) {
    return {
      ...ruled,
      summary: {
        ...ruled.summary,
        warnings: [
          ...ruled.summary.warnings,
          ai.detail.includes('설정되지 않았습니다')
            ? `사양 혼재 ${aiTargets.length}건 — AI 미설정으로 규칙 분리만 적용`
            : `AI 사양 정규화 실패: ${ai.detail}`,
        ],
      },
    }
  }

  const byCode = new Map(ai.splits.map((split) => [split.code.toLowerCase(), split]))
  let aiApplied = 0
  const lines = ruled.lines.map((line) => {
    if (!bomLineNeedsSpecNormalize(line)) return line
    const split = byCode.get(lineAiCode(line).toLowerCase())
    if (!split) return line
    aiApplied += 1
    return applyAiSplitToLine(line, split)
  })

  const warnings = [...ruled.summary.warnings]
  if (aiApplied > 0) {
    warnings.push(`BOM 사양 정규화(AI) ${aiApplied}건 — Specification → Value/Package/MPN`)
  }

  return {
    ...ruled,
    lines,
    designatorIndex: rebuildDesignatorIndex(lines),
    summary: {
      ...ruled.summary,
      warnings,
    },
  }
}
