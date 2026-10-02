import { resolveBomLineAlternates } from './alternates'
import type { BomGroup, BomLinePayload, BomProcess } from './types'
import { normalizeBomProcess } from './types'
import type { Item, ItemCategory } from '@/lib/items/types'
import { isRawMaterialItemCategory } from '@/lib/items/types'

export type BomFormLine = {
  key: string
  childProductId: string
  quantityPer: string
  process: BomProcess
  designators: string
  sourceMpn: string
  sourcePartCode: string
  sourceName: string
  sourceSpec: string
  /** 대체 품목코드·MPN (쉼표 구분) */
  sourceAlternates: string
}

export type BomFormState = {
  parentProductId: string
  lines: BomFormLine[]
}

let lineKeySeq = 0

export function createBomFormLine(
  partial?: Partial<Omit<BomFormLine, 'key'>> & { key?: string },
): BomFormLine {
  lineKeySeq += 1
  return {
    key: partial?.key || `bom-line-${lineKeySeq}`,
    childProductId: partial?.childProductId || '',
    quantityPer: partial?.quantityPer ?? '',
    process: normalizeBomProcess(partial?.process),
    designators: partial?.designators?.trim() || '',
    sourceMpn: partial?.sourceMpn?.trim() || '',
    sourcePartCode: partial?.sourcePartCode?.trim() || '',
    sourceName: partial?.sourceName?.trim() || '',
    sourceSpec: partial?.sourceSpec?.trim() || '',
    sourceAlternates: partial?.sourceAlternates?.trim() || '',
  }
}

const EMPTY_SHEET_ROWS = 20

export function createEmptyBomSheetLines(rowCount = EMPTY_SHEET_ROWS): BomFormLine[] {
  return Array.from({ length: Math.max(1, rowCount) }, () => createBomFormLine())
}

export function emptyBomForm(parentProductId = ''): BomFormState {
  return {
    parentProductId,
    lines: createEmptyBomSheetLines(),
  }
}

export function bomGroupToForm(group: BomGroup): BomFormState {
  const lines = group.lines.length
    ? group.lines.map((line) =>
        createBomFormLine({
          childProductId: line.childProductId,
          quantityPer: String(line.quantityPer),
          process: line.process,
          designators: line.designators,
          sourceMpn: line.sourceMpn || line.childMpn,
          sourcePartCode: line.sourcePartCode,
          sourceName: line.sourceName || line.childProductName,
          sourceSpec: line.sourceSpec,
          sourceAlternates: line.sourceAlternates,
        }),
      )
    : []

  const pad = Math.max(0, EMPTY_SHEET_ROWS - lines.length)
  return {
    parentProductId: group.parentProductId,
    lines: pad > 0 ? [...lines, ...createEmptyBomSheetLines(pad)] : lines.length ? lines : createEmptyBomSheetLines(),
  }
}

export function formToBomLinePayloads(
  form: BomFormState,
  childItems: Item[] = [],
): BomLinePayload[] {
  return form.lines
    .map((line) => {
      const childProductId = line.childProductId.trim()
      return {
        childProductId,
        quantityPer: Number(line.quantityPer),
        note: '',
        process: normalizeBomProcess(line.process),
        designators: line.designators.trim(),
        sourceMpn: line.sourceMpn.trim(),
        sourcePartCode: line.sourcePartCode.trim(),
        sourceName: line.sourceName.trim(),
        sourceSpec: line.sourceSpec.trim(),
        sourceAlternates: line.sourceAlternates.trim(),
        alternateChildProductIds: resolveBomLineAlternates(
          childProductId,
          line.sourceAlternates,
          childItems,
        ).alternateChildProductIds,
      }
    })
    .filter((line) => line.childProductId)
}

export function validateBomForm(
  form: BomFormState,
  options?: {
    parentItemCategory?: ItemCategory | null
    childItems?: Array<Pick<Item, 'id' | 'baseCode' | 'itemCategory'>>
    /** true면 미매칭 행을 저장 전 원자재 자동등록에 맡김 */
    allowUnmatched?: boolean
  },
): string | null {
  if (!form.parentProductId.trim()) {
    return '부모 품목을 선택해 주세요.'
  }

  const unmatchedCount = form.lines.filter(
    (line) =>
      !line.childProductId.trim() &&
      (line.sourcePartCode.trim() ||
        line.sourceMpn.trim() ||
        line.sourceName.trim() ||
        line.designators.trim()),
  ).length
  if (unmatchedCount > 0 && !options?.allowUnmatched) {
    return `미등록 품목 ${unmatchedCount}건이 있습니다. 품목코드 또는 MPN을 확인해 주세요.`
  }

  const payloads = formToBomLinePayloads(form)
  if (!payloads.length) {
    return '구성 품목을 하나 이상 추가해 주세요.'
  }

  const childById = new Map(
    (options?.childItems || []).map((item) => [item.id, item] as const),
  )
  const seen = new Set<string>()
  const seenRawBaseCodes = new Set<string>()
  const isSemiParent = options?.parentItemCategory === 3

  for (const line of payloads) {
    if (line.childProductId === form.parentProductId.trim()) {
      return '부모 품목과 같은 품목을 구성에 넣을 수 없습니다.'
    }
    if (!Number.isFinite(line.quantityPer) || line.quantityPer <= 0) {
      return '소요량은 0보다 큰 숫자여야 합니다.'
    }
    if (seen.has(line.childProductId)) {
      const child = childById.get(line.childProductId)
      const label = child?.baseCode.trim() || line.childProductId
      return `구성 품목 ${label} 이(가) 중복되었습니다.`
    }
    seen.add(line.childProductId)

    if (isSemiParent) {
      const child = childById.get(line.childProductId)
      if (child && isRawMaterialItemCategory(child.itemCategory)) {
        const rawCode = (child.baseCode.trim() || child.id).toLowerCase()
        if (seenRawBaseCodes.has(rawCode)) {
          return `원자재 품목코드 ${child.baseCode.trim() || child.id} 이(가) BOM에 중복되었습니다.`
        }
        seenRawBaseCodes.add(rawCode)
      }
    }
  }

  return null
}
