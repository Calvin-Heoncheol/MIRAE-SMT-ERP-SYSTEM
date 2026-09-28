'use client'

import type { BomFormLine } from '@/lib/bom/form-state'
import { rematchBomFormLine } from '@/lib/bom/bulk-paste'
import {
  emptyItemForm,
  formToItemPayload,
  type ItemFormState,
} from '@/lib/items/form-state'
import { createItems, fetchItems } from '@/lib/items/repository'
import type { Item, ItemMaterialType } from '@/lib/items/types'
import { isSemiFinishedItemCategory } from '@/lib/items/types'

function isFilledUnmatchedLine(line: BomFormLine) {
  return (
    !line.childProductId.trim() &&
    Boolean(
      line.sourcePartCode.trim() ||
        line.sourceMpn.trim() ||
        line.sourceName.trim() ||
        line.designators.trim(),
    )
  )
}

function materialTypeFromProcess(process: BomFormLine['process']): ItemMaterialType {
  if (process === 'dip') return 'DIP'
  if (process === 'smd') return 'SMD'
  return 'SMD'
}

function buildRawMaterialForm(
  line: BomFormLine,
  parent: Pick<Item, 'customerId'>,
): ItemFormState | { error: string } {
  const baseCode = line.sourcePartCode.trim() || line.sourceMpn.trim()
  if (!baseCode) {
    return {
      error: `품목코드 또는 MPN이 없는 행은 자동 등록할 수 없습니다. (${line.sourceName || '빈 행'})`,
    }
  }

  if (!parent.customerId.trim()) {
    return {
      error: '부모 품목에 고객사가 없어 원자재를 자동 등록할 수 없습니다. 부모 품목을 먼저 확인해 주세요.',
    }
  }

  const form = emptyItemForm()
  form.itemCategory = 1
  form.id = baseCode
  form.name = line.sourceName.trim() || baseCode
  form.specification = line.sourceSpec.trim()
  form.mpn = line.sourceMpn.trim()
  form.materialType = materialTypeFromProcess(line.process)
  form.customerId = parent.customerId.trim()
  form.supplyType = ''
  return form
}

export type RegisterMissingBomRawResult =
  | {
      ok: true
      lines: BomFormLine[]
      createdCount: number
      items: Item[]
    }
  | { ok: false; detail: string }

/**
 * 반제품 BOM 저장 시 — 미매칭 행을 원자재로 등록한 뒤 표 행을 다시 매칭합니다.
 */
export async function registerMissingBomRawMaterials(input: {
  lines: BomFormLine[]
  parent: Item
  existingItems: Item[]
}): Promise<RegisterMissingBomRawResult> {
  if (!isSemiFinishedItemCategory(input.parent.itemCategory)) {
    const unmatched = input.lines.filter(isFilledUnmatchedLine)
    if (unmatched.length) {
      return {
        ok: false,
        detail: `미등록 ${unmatched.length}건이 있습니다. 조립제품 BOM의 구성(반제품)은 자동 등록되지 않습니다. 품목코드/MPN을 확인해 주세요.`,
      }
    }
    return {
      ok: true,
      lines: input.lines,
      createdCount: 0,
      items: input.existingItems,
    }
  }

  const unmatched = input.lines.filter(isFilledUnmatchedLine)
  if (!unmatched.length) {
    return {
      ok: true,
      lines: input.lines,
      createdCount: 0,
      items: input.existingItems,
    }
  }

  const forms: ItemFormState[] = []
  const seenCodes = new Set<string>()

  for (const line of unmatched) {
    const built = buildRawMaterialForm(line, input.parent)
    if ('error' in built) return { ok: false, detail: built.error }

    const codeKey = built.id.trim().toLowerCase()
    if (seenCodes.has(codeKey)) continue
    seenCodes.add(codeKey)
    forms.push(built)
  }

  if (!forms.length) {
    return { ok: false, detail: '자동 등록할 원자재가 없습니다.' }
  }

  let payloads
  try {
    payloads = forms.map((form) => formToItemPayload(form))
  } catch (error) {
    return {
      ok: false,
      detail: error instanceof Error ? error.message : '원자재 등록 데이터를 만들지 못했습니다.',
    }
  }

  const created = await createItems(payloads, { skipExisting: true })
  if (!created.ok) {
    // 전부 이미 등록된 경우 — 목록을 다시 불러 매칭만 시도
    if (created.duplicateCodes?.length) {
      const refreshed = await fetchItems(false)
      if (!refreshed.ok) {
        return { ok: false, detail: created.detail }
      }
      const lines = normalizeMatchedQty(
        input.lines.map((line) =>
          line.childProductId.trim() ? line : rematchBomFormLine(line, refreshed.items),
        ),
      )
      const still = lines.filter(isFilledUnmatchedLine)
      if (still.length) {
        return {
          ok: false,
          detail: `이미 등록된 코드와 충돌하거나 연결에 실패했습니다. (${still
            .slice(0, 3)
            .map((line) => line.sourcePartCode || line.sourceMpn || line.sourceName)
            .join(', ')})`,
        }
      }
      return {
        ok: true,
        lines,
        createdCount: 0,
        items: refreshed.items,
      }
    }
    return { ok: false, detail: created.detail }
  }

  const refreshed = await fetchItems(false)
  if (!refreshed.ok) {
    return {
      ok: false,
      detail: `원자재 ${created.ids.length}건은 등록됐지만 목록을 다시 불러오지 못했습니다. ${refreshed.detail}`,
    }
  }

  const lines = normalizeMatchedQty(
    input.lines.map((line) =>
      line.childProductId.trim() ? line : rematchBomFormLine(line, refreshed.items),
    ),
  )

  const still = lines.filter(isFilledUnmatchedLine)
  if (still.length) {
    return {
      ok: false,
      detail: `원자재 등록 후에도 미등록 ${still.length}건이 남았습니다. (${still
        .slice(0, 3)
        .map((line) => line.sourcePartCode || line.sourceMpn || line.sourceName)
        .join(', ')})`,
    }
  }

  return {
    ok: true,
    lines,
    createdCount: created.ids.length,
    items: refreshed.items,
  }
}

function normalizeMatchedQty(lines: BomFormLine[]): BomFormLine[] {
  return lines.map((line) => {
    if (line.childProductId.trim() && !line.quantityPer.trim()) {
      return { ...line, quantityPer: '1' }
    }
    return line
  })
}
