import type { Item } from '@/lib/items/types'

/** SFG-001-V2 → base SFG-001, version 2 / SFG-001 → base SFG-001, version null */
const VERSION_SUFFIX_RE = /^(.+)-V(\d+)$/i
/** 이전 -B 형식도 base 추출용으로 인식 */
const LEGACY_LETTER_SUFFIX_RE = /^(.+)-([A-Z])$/i

export function parseItemVersionCode(id: string): { base: string; version: number | null } {
  const trimmed = id.trim()
  const versionMatch = trimmed.match(VERSION_SUFFIX_RE)
  if (versionMatch) {
    const version = Number(versionMatch[2])
    return {
      base: versionMatch[1],
      version: Number.isFinite(version) && version > 0 ? version : null,
    }
  }

  const legacyMatch = trimmed.match(LEGACY_LETTER_SUFFIX_RE)
  if (legacyMatch) {
    return { base: legacyMatch[1], version: null }
  }

  return { base: trimmed, version: null }
}

/**
 * 다음 버전 코드 제안.
 * - SFG-001 → SFG-001-V1
 * - SFG-001-V1 → SFG-001-V2
 * 이미 있는 코드는 건너뜀.
 */
export function suggestNextVersionItemCode(
  currentId: string,
  existingIds: string[],
): string | null {
  const { base, version } = parseItemVersionCode(currentId)
  if (!base) return null

  const taken = new Set(existingIds.map((id) => id.trim().toUpperCase()).filter(Boolean))
  const start = version != null ? version + 1 : 1

  for (let n = start; n <= 999; n += 1) {
    const candidate = `${base}-V${n}`
    if (!taken.has(candidate.toUpperCase())) {
      return candidate
    }
  }

  return null
}

export function itemToVersionUpPayload(item: Item, newId: string) {
  return {
    id: newId,
    name: item.name,
    specification: item.specification,
    mpn: item.mpn,
    materialType: item.materialType,
    supplyType: item.supplyType,
    supplier: item.supplier,
    pcbSideMode: item.pcbSideMode,
    processType: item.processType,
    unitPrice: item.unitPrice,
    smdUnitPrice: item.smdUnitPrice,
    dipUnitPrice: item.dipUnitPrice,
    materialUnitPrice: item.materialUnitPrice,
    itemCategory: item.itemCategory,
    safetyStock: item.safetyStock,
  }
}
