import { saveBomForParent } from '@/lib/bom/repository'
import type { BomGroup, BomLinePayload } from '@/lib/bom/types'
import { createItem, setItemActive } from '@/lib/items/repository'
import type { Item } from '@/lib/items/types'
import { itemToVersionUpPayload, suggestNextVersionItemCode } from '@/lib/items/version-code'

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
 * 부모 품목 + BOM 구성을 새 버전 코드로 복제.
 * 예: SFG-001 → SFG-001-V1 (속성·BOM 복사, 선택 시 구버전 사용중지)
 */
export async function versionUpBomParent(input: {
  sourceItem: Item
  group: BomGroup
  existingItemIds: string[]
  deactivateSource?: boolean
}): Promise<VersionUpBomResult> {
  const { sourceItem, group, existingItemIds, deactivateSource = true } = input

  if (group.parentProductId !== sourceItem.id) {
    return { ok: false, detail: '버전업 대상 품목이 BOM과 일치하지 않습니다.' }
  }

  const lines = toPayloads(group)
  if (!lines.length) {
    return { ok: false, detail: '복사할 BOM 구성이 없습니다.' }
  }

  const newId = suggestNextVersionItemCode(sourceItem.id, existingItemIds)
  if (!newId) {
    return {
      ok: false,
      detail: '다음 버전 코드를 만들 수 없습니다. (V1~V999 소진)',
    }
  }

  const createResult = await createItem(itemToVersionUpPayload(sourceItem, newId))
  if (!createResult.ok) {
    return { ok: false, detail: createResult.detail }
  }

  const bomResult = await saveBomForParent(createResult.id, lines)
  if (!bomResult.ok) {
    return {
      ok: false,
      detail: `품목 ${createResult.id} 은(는) 생성됐지만 BOM 복사에 실패했습니다: ${bomResult.detail}`,
    }
  }

  let deactivatedSource = false
  if (deactivateSource) {
    const deactivateResult = await setItemActive(sourceItem.id, false)
    if (!deactivateResult.ok) {
      return {
        ok: false,
        detail: `새 버전 ${createResult.id} 은(는) 만들었지만 구버전 사용중지에 실패했습니다: ${deactivateResult.detail}`,
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
