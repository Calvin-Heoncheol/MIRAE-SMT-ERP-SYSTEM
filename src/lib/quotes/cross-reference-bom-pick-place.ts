import type { AltiumBomAnalysis, BomLine } from '@/lib/quotes/parse-altium-bom'
import { bomExcludeReasonLabel, type BomExcludeReason } from '@/lib/quotes/bom-dnp'
import type {
  AltiumPickPlaceAnalysis,
  PickPlaceClassifiedRow,
} from '@/lib/quotes/parse-altium-pick-place'
import {
  classifyPickPlaceRow,
  rebuildPickPlaceAnalysis,
} from '@/lib/quotes/parse-altium-pick-place'
import {
  classifyPickPlaceDipFromRow,
  detectThroughHoleMount,
  pickPlaceCategoryLabel,
} from '@/lib/quotes/pick-place-mount-categories'

export type CrossRefStatus = 'matched' | 'bom_only' | 'pnp_only'

export type BomPickPlaceCrossRefRow = {
  designator: string
  status: CrossRefStatus
  bomLine?: BomLine
  pickPlaceRow?: PickPlaceClassifiedRow
  note?: string
}

export type BomPickPlaceCrossRef = {
  rows: BomPickPlaceCrossRefRow[]
  matchedCount: number
  bomOnlyCount: number
  pnpOnlyCount: number
  dipCandidateCount: number
  warnings: string[]
}

import { normalizeDesignatorKey } from '@/lib/quotes/designator-utils'

function isThroughHoleCandidate(line: BomLine, designator = '') {
  return detectThroughHoleMount({
    package: line.footprint,
    description: line.description,
    value: line.comment,
    designator,
  }).isThroughHole
}

function pickPlaceRowExcludedByBom(
  row: PickPlaceClassifiedRow,
  bomLine: BomLine,
): PickPlaceClassifiedRow {
  return {
    ...row,
    category: 'skip',
    categoryLabel: '제외',
    confidence: 'certain',
    detail: bomExcludeReasonLabel(bomLine.excludeReason ?? 'strikethrough', bomLine),
    bomExcluded: true,
    bomExcludeReason: bomLine.excludeReason ?? 'strikethrough',
    reviewSource: undefined,
  }
}

function mergePickPlaceRowWithBom(
  row: PickPlaceClassifiedRow,
  bomLine: BomLine,
  hasLayerColumn: boolean,
): PickPlaceClassifiedRow {
  const mergedRow = {
    ...row,
    package: row.package || bomLine.footprint,
    value: row.value || bomLine.comment,
    description: row.description || bomLine.description,
    mpn: row.mpn || bomLine.mpn,
  }

  let classified = classifyPickPlaceRow(mergedRow, { hasLayerColumn })

  const dipFromRow = classifyPickPlaceDipFromRow({
    category: classified.category,
    package: mergedRow.package,
    description: mergedRow.description,
    value: mergedRow.value,
    designator: mergedRow.designator,
    detail: classified.detail,
  })
  if (dipFromRow) {
    return {
      ...classified,
      category: dipFromRow.category,
      categoryLabel: pickPlaceCategoryLabel(dipFromRow.category),
      confidence: dipFromRow.confidence,
      detail: dipFromRow.detail,
    }
  }

  return classified
}

function isConnectorDesignator(designator: string) {
  const des = designator.toUpperCase()
  return des.startsWith('H') || des.startsWith('CON') || des.startsWith('J') || des.startsWith('P')
}

export function crossReferenceBomPickPlace(
  bom: AltiumBomAnalysis,
  pickPlace: AltiumPickPlaceAnalysis,
): BomPickPlaceCrossRef {
  const pnpMap = new Map<string, PickPlaceClassifiedRow>()
  for (const row of pickPlace.classifiedRows) {
    pnpMap.set(normalizeDesignatorKey(row.designator), row)
  }

  const bomDesignators = new Set<string>()
  for (const line of bom.lines) {
    for (const designator of line.designators) {
      bomDesignators.add(normalizeDesignatorKey(designator))
    }
  }

  const allDesignators = new Set<string>([...bomDesignators, ...pnpMap.keys()])
  const rows: BomPickPlaceCrossRefRow[] = []
  const warnings: string[] = []

  let matchedCount = 0
  let bomOnlyCount = 0
  let pnpOnlyCount = 0
  let dipCandidateCount = 0
  let excludedWithPickPlaceCount = 0

  for (const key of [...allDesignators].sort()) {
    const bomLine = bom.designatorIndex[key]
    const pickPlaceRow = pnpMap.get(key)

    if (bomLine && pickPlaceRow) {
      if (bomLine.excluded) {
        excludedWithPickPlaceCount += 1
        rows.push({
          designator: key,
          status: 'matched',
          bomLine,
          pickPlaceRow,
          note: bomExcludeReasonLabel(bomLine.excludeReason ?? 'strikethrough', bomLine),
        })
        continue
      }

      matchedCount += 1
      let note: string | undefined
      if (!pickPlaceRow.package && bomLine.footprint) {
        note = `BOM Package: ${bomLine.footprint}`
      } else if (bomLine.comment && bomLine.comment !== pickPlaceRow.value) {
        note = `BOM Value: ${bomLine.comment}`
      }
      rows.push({ designator: key, status: 'matched', bomLine, pickPlaceRow, note })
      continue
    }

    if (bomLine) {
      bomOnlyCount += 1
      const dipHint = !bomLine.excluded && isThroughHoleCandidate(bomLine, key)
      if (dipHint) dipCandidateCount += 1
      rows.push({
        designator: key,
        status: 'bom_only',
        bomLine,
        note: dipHint ? '수삽(DIP/TH) 후보 — 좌표 파일에 없음' : '좌표 파일에 없음 (미실장·수삽·기구물)',
      })
      continue
    }

    if (pickPlaceRow) {
      pnpOnlyCount += 1
      rows.push({
        designator: key,
        status: 'pnp_only',
        pickPlaceRow,
        note: 'BOM에 없음 (테스트포인트·마킹·기구물 가능)',
      })
    }
  }

  if (excludedWithPickPlaceCount > 0) {
    warnings.push(
      `BOM 미실장 ${excludedWithPickPlaceCount}건 — 좌표에 있으나 견적에서 자동 제외했습니다.`,
    )
  }
  if (bomOnlyCount > 0) {
    warnings.push(`BOM에만 있는 부품 ${bomOnlyCount}건 — 수삽·미실장 여부를 확인하세요.`)
  }
  if (pnpOnlyCount > 0) {
    warnings.push(`좌표에만 있는 항목 ${pnpOnlyCount}건 — 테스트포인트·기구물일 수 있습니다.`)
  }
  if (dipCandidateCount > 0) {
    warnings.push(`수삽(DIP/TH) 후보 ${dipCandidateCount}건 — DIP 섹션을 확인하세요.`)
  }

  return {
    rows,
    matchedCount,
    bomOnlyCount,
    pnpOnlyCount,
    dipCandidateCount,
    warnings,
  }
}

export function suggestDipCountsFromBom(
  bom: AltiumBomAnalysis,
  crossRef: BomPickPlaceCrossRef,
): { dipGeneral: number; dipConnector: number } {
  let dipGeneral = 0
  let dipConnector = 0

  for (const row of crossRef.rows) {
    if (row.status !== 'bom_only' || !row.bomLine) continue
    if (!isThroughHoleCandidate(row.bomLine)) continue

    const count = 1
    if (isConnectorDesignator(row.designator)) {
      dipConnector += count
    } else {
      dipGeneral += count
    }
  }

  return { dipGeneral, dipConnector }
}

export function enrichPickPlaceWithBom(
  pickPlace: AltiumPickPlaceAnalysis,
  bom: AltiumBomAnalysis,
): AltiumPickPlaceAnalysis {
  const hasLayerColumn = pickPlace.classifiedRows.some((row) => row.rawLayer.trim().length > 0)

  const classifiedRows = pickPlace.classifiedRows.map((row) => {
    const bomLine = bom.designatorIndex[normalizeDesignatorKey(row.designator)]
    if (!bomLine) return row
    if (bomLine.excluded) return pickPlaceRowExcludedByBom(row, bomLine)
    return mergePickPlaceRowWithBom(row, bomLine, hasLayerColumn)
  })

  return rebuildPickPlaceAnalysis(pickPlace, classifiedRows)
}
