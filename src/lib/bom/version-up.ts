import { saveBomForParent } from '@/lib/bom/repository'
import type { BomGroup, BomLinePayload } from '@/lib/bom/types'
import { createItem, setItemActive } from '@/lib/items/repository'
import type { Item } from '@/lib/items/types'
import {
  itemToVersionUpPayload,
  resolveManualVersionForItem,
  suggestNextVersionForItem,
} from '@/lib/items/version-code'

export type VersionUpBomResult =
  | {
      ok: true
      newItemId: string
      newGroup: BomGroup
      deactivatedSource: boolean
    }
  | { ok: false; detail: string }

function toPayloads(group: BomGroup): BomLinePayload[] {
  return group.lines
    .filter((line) => line.childProductId.trim())
    .map((line) => ({
      childProductId: line.childProductId.trim(),
      quantityPer: line.quantityPer,
      note: line.note || '',
    }))
}

/**
 * 부모 품목 + BOM 구성을 새 버전 행으로 복제.
 * 예: base ABC / A1 → ABC / A2 (같은 품목코드, 새 버전 행 + BOM)
 * 기본값은 구버전 유지(사용중지하지 않음).
 */
export async function versionUpBomParent(input: {
  sourceItem: Item
  group: BomGroup
  existingItems: Item[]
  /** 사용자가 지정한 신버전 (비우면 자동 제안) */
  newVersion?: string
  /** @deprecated existingItemIds — existingItems 권장 */
  existingItemIds?: string[]
  deactivateSource?: boolean
}): Promise<VersionUpBomResult> {
  const {
    sourceItem,
    group,
    existingItems,
    newVersion,
    existingItemIds,
    deactivateSource = false,
  } = input

  if (group.parentProductId !== sourceItem.id) {
    return { ok: false, detail: '버전업 대상 품목이 BOM과 일치하지 않습니다.' }
  }

  const lines = toPayloads(group)
  if (!lines.length) {
    return { ok: false, detail: '복사할 BOM 구성이 없습니다.' }
  }

  const legacyItems =
    existingItems.length > 0
      ? existingItems
      : (existingItemIds || []).map(
          (id) =>
            ({
              id,
              baseCode: id,
              version: '',
            }) as Item,
        )

  const manualVersion = String(newVersion || '').trim()
  let next: { newId: string; baseCode: string; version: string } | null = null

  if (manualVersion) {
    const resolved = resolveManualVersionForItem(sourceItem, manualVersion, legacyItems)
    if (!resolved.ok) {
      return { ok: false, detail: resolved.detail }
    }
    next = {
      newId: resolved.newId,
      baseCode: resolved.baseCode,
      version: resolved.version,
    }
  } else {
    next = suggestNextVersionForItem(sourceItem, legacyItems)
    if (!next) {
      return {
        ok: false,
        detail: '다음 버전을 만들 수 없습니다. (버전 번호 소진)',
      }
    }
  }

  const createResult = await createItem(
    itemToVersionUpPayload(sourceItem, next.newId, {
      baseCode: next.baseCode,
      version: next.version,
    }),
  )
  if (!createResult.ok) {
    return { ok: false, detail: createResult.detail }
  }

  const bomResult = await saveBomForParent(createResult.id, lines)
  if (!bomResult.ok) {
    return {
      ok: false,
      detail: `품목 ${next.baseCode} (${next.version}) 은(는) 생성됐지만 BOM 복사에 실패했습니다: ${bomResult.detail}`,
    }
  }

  let deactivatedSource = false
  if (deactivateSource) {
    const deactivateResult = await setItemActive(sourceItem.id, false)
    if (!deactivateResult.ok) {
      return {
        ok: false,
        detail: `새 버전 ${next.version} 은(는) 만들었지만 구버전 사용중지에 실패했습니다: ${deactivateResult.detail}`,
      }
    }
    deactivatedSource = true
  }

  const newGroup: BomGroup = {
    parentProductId: createResult.id,
    parentProductName: sourceItem.name,
    parentItemCategory: sourceItem.itemCategory,
    lines: group.lines.map((line) => ({
      ...line,
      parentProductId: createResult.id,
      parentProductName: sourceItem.name,
    })),
  }

  return {
    ok: true,
    newItemId: createResult.id,
    newGroup,
    deactivatedSource,
  }
}
