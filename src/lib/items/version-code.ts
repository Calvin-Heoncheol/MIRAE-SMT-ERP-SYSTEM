import type { Item } from '@/lib/items/types'

/**
 * 코드 끝의 버전 접미사.
 * - 0302C210-V1 → V1
 * - 0302C210-REV2 → REV2
 * - SFG-001 (숫자만 있는 구간)은 버전으로 보지 않음
 */
const VERSION_SUFFIX_RE = /^(.+)-([A-Za-z][A-Za-z0-9]*)$/

/** 숫자만 입력하면 기존처럼 Vn 으로 맞춤 */
const DIGITS_ONLY_RE = /^\d+$/
const V_NUMBER_RE = /^V(\d+)$/i
const REV_NUMBER_RE = /^REV(\d+)$/i

export function normalizeVersionLabel(versionInput: string | number): string {
  const raw = String(versionInput ?? '')
    .trim()
    .replace(/^-+/, '')
    .replace(/\s+/g, '')
  if (!raw) return ''
  if (DIGITS_ONLY_RE.test(raw)) {
    const n = Math.floor(Number(raw))
    if (!Number.isFinite(n) || n <= 0) return ''
    return `V${n}`
  }
  return raw
}

export function parseItemVersionCode(id: string): { base: string; version: string | null } {
  const trimmed = id.trim()
  const versionMatch = trimmed.match(VERSION_SUFFIX_RE)
  if (versionMatch) {
    return {
      base: versionMatch[1],
      version: versionMatch[2],
    }
  }

  return { base: trimmed, version: null }
}

/**
 * 품목코드에 버전 접미사 적용.
 * - 비우면 base만
 * - `1` → BASE-V1 (기존 호환)
 * - `V1` / `REV2` → BASE-V1 / BASE-REV2
 */
export function composeItemIdWithVersion(baseOrFullId: string, versionInput: string | number) {
  const { base } = parseItemVersionCode(String(baseOrFullId || '').trim())
  if (!base) return String(baseOrFullId || '').trim()
  const label = normalizeVersionLabel(versionInput)
  if (!label) return base
  return `${base}-${label}`
}

export function formatItemVersionLabel(version: string | null) {
  return version?.trim() ? version.trim() : '—'
}

export function versionToFormValue(version: string | null) {
  return version?.trim() ? version.trim() : ''
}

/**
 * 다음 버전 코드 제안.
 * - …-V1 → …-V2
 * - …-REV2 → …-REV3
 * - 그 외/없음 → …-V1 부터 빈 번호 탐색
 */
export function suggestNextVersionItemCode(
  currentId: string,
  existingIds: string[],
): string | null {
  const { base, version } = parseItemVersionCode(currentId)
  if (!base) return null

  const taken = new Set(existingIds.map((id) => id.trim().toUpperCase()).filter(Boolean))

  const vMatch = version?.match(V_NUMBER_RE)
  if (vMatch) {
    const start = Number(vMatch[1]) + 1
    for (let n = start; n <= 999; n += 1) {
      const candidate = `${base}-V${n}`
      if (!taken.has(candidate.toUpperCase())) return candidate
    }
    return null
  }

  const revMatch = version?.match(REV_NUMBER_RE)
  if (revMatch) {
    const start = Number(revMatch[1]) + 1
    for (let n = start; n <= 999; n += 1) {
      const candidate = `${base}-REV${n}`
      if (!taken.has(candidate.toUpperCase())) return candidate
    }
    return null
  }

  for (let n = 1; n <= 999; n += 1) {
    const candidate = `${base}-V${n}`
    if (!taken.has(candidate.toUpperCase())) return candidate
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
