import type { Item } from '@/lib/items/types'

/**
 * 코드 끝의 버전 접미사.
 * - 0302C210-V1 → V1
 * - 0302C210-REV2 → REV2
 * - ABC-A1 → A1
 * - SFG-001 (숫자만 있는 구간)은 버전으로 보지 않음
 */
const VERSION_SUFFIX_RE = /^(.+)-([A-Za-z][A-Za-z0-9]*)$/

/** 숫자만 입력하면 기존처럼 Vn 으로 맞춤 */
const DIGITS_ONLY_RE = /^\d+$/
const V_NUMBER_RE = /^V(\d+)$/i
const REV_NUMBER_RE = /^REV(\d+)$/i
const LETTER_NUMBER_RE = /^([A-Za-z]+)(\d+)$/

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

/** Item 행 기준 base/version (컬럼 우선, 없으면 id 파싱) */
export function resolveItemBaseAndVersion(item: Pick<Item, 'id' | 'baseCode' | 'version'>) {
  const baseCode = String(item.baseCode || '').trim()
  const version = String(item.version || '').trim()
  if (baseCode) {
    return { base: baseCode, version: version || null }
  }
  return parseItemVersionCode(item.id)
}

/**
 * 품목명 끝에 버전이 이미 붙어 있으면 제거 (구 데이터: "0302C6QA A0" + 코드 -A0).
 * 예: ("0302C6QA A0", "A0") → "0302C6QA"
 */
export function stripTrailingVersionFromName(name: string, version: string | null | undefined) {
  const label = String(version || '').trim()
  if (!label) return name.trim()
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const stripped = name
    .trim()
    .replace(new RegExp(`(?:[\\s\\-_]+)${escaped}$`, 'i'), '')
    .trim()
  return stripped || name.trim()
}

/**
 * 품목코드에 버전 접미사 적용 (내부 PK용).
 * - 비우면 base만
 * - `1` → BASE-V1 (기존 호환)
 * - `V1` / `A2` / `REV2` → BASE-V1 / BASE-A2 / BASE-REV2
 */
export function composeItemIdWithVersion(baseOrFullId: string, versionInput: string | number) {
  const { base } = parseItemVersionCode(String(baseOrFullId || '').trim())
  if (!base) return String(baseOrFullId || '').trim()
  const label = normalizeVersionLabel(versionInput)
  if (!label) return base
  return `${base}-${label}`
}

export function formatItemVersionLabel(version: string | null | undefined) {
  return version?.trim() ? version.trim() : '—'
}

export function versionToFormValue(version: string | null | undefined) {
  return version?.trim() ? version.trim() : ''
}

function takenIdSet(existingIds: string[]) {
  return new Set(existingIds.map((id) => id.trim().toUpperCase()).filter(Boolean))
}

function firstFreeCandidate(base: string, taken: Set<string>, makeLabel: (n: number) => string) {
  for (let n = 1; n <= 999; n += 1) {
    const candidate = `${base}-${makeLabel(n)}`
    if (!taken.has(candidate.toUpperCase())) return candidate
  }
  return null
}

/**
 * 다음 버전 코드 제안.
 * - …-A1 → …-A2
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

  const taken = takenIdSet(existingIds)

  const letterNum = version?.match(LETTER_NUMBER_RE)
  if (letterNum && !V_NUMBER_RE.test(version!) && !REV_NUMBER_RE.test(version!)) {
    const prefix = letterNum[1]
    const start = Number(letterNum[2]) + 1
    for (let n = start; n <= 999; n += 1) {
      const candidate = `${base}-${prefix}${n}`
      if (!taken.has(candidate.toUpperCase())) return candidate
    }
    return null
  }

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

  return firstFreeCandidate(base, taken, (n) => `V${n}`)
}

function collectExistingItemIds(
  existingItems: Pick<Item, 'id' | 'baseCode' | 'version'>[],
): string[] {
  const existingIds = existingItems.map((row) => {
    const resolved = resolveItemBaseAndVersion(row)
    if (resolved.version) return composeItemIdWithVersion(resolved.base, resolved.version)
    return row.id
  })
  for (const row of existingItems) {
    if (row.id) existingIds.push(row.id)
  }
  return existingIds
}

/** base_code 기준으로 다음 버전 행 제안 */
export function suggestNextVersionForItem(
  item: Pick<Item, 'id' | 'baseCode' | 'version'>,
  existingItems: Pick<Item, 'id' | 'baseCode' | 'version'>[],
): { newId: string; baseCode: string; version: string } | null {
  const { base, version } = resolveItemBaseAndVersion(item)
  if (!base) return null

  const existingIds = collectExistingItemIds(existingItems)
  const currentId = version ? composeItemIdWithVersion(base, version) : item.id
  const newId = suggestNextVersionItemCode(currentId || `${base}-V0`, existingIds)
  if (!newId) return null
  const parsed = parseItemVersionCode(newId)
  if (!parsed.version) return null
  return { newId, baseCode: base, version: parsed.version }
}

/**
 * 사용자가 입력한 버전으로 새 품목 id 구성.
 * 이미 같은 base+version 이 있으면 null.
 */
export function resolveManualVersionForItem(
  item: Pick<Item, 'id' | 'baseCode' | 'version'>,
  versionInput: string,
  existingItems: Pick<Item, 'id' | 'baseCode' | 'version'>[],
):
  | { ok: true; newId: string; baseCode: string; version: string }
  | { ok: false; detail: string } {
  const { base } = resolveItemBaseAndVersion(item)
  if (!base) return { ok: false, detail: '품목코드를 확인할 수 없습니다.' }

  const version = normalizeVersionLabel(versionInput)
  if (!version) return { ok: false, detail: '신버전을 입력해 주세요.' }

  const current = resolveItemBaseAndVersion(item)
  if (
    current.version &&
    normalizeVersionLabel(current.version).toUpperCase() === version.toUpperCase()
  ) {
    return { ok: false, detail: '구버전과 같은 버전입니다. 다른 버전을 입력해 주세요.' }
  }

  const newId = composeItemIdWithVersion(base, version)
  const taken = takenIdSet(collectExistingItemIds(existingItems))
  if (taken.has(newId.toUpperCase())) {
    return {
      ok: false,
      detail: `이미 존재하는 버전입니다: ${base} / ${version}`,
    }
  }

  return { ok: true, newId, baseCode: base, version }
}

export function itemToVersionUpPayload(
  item: Item,
  newId: string,
  options?: { baseCode?: string; version?: string },
) {
  const parsed = parseItemVersionCode(newId)
  const baseCode = (options?.baseCode || item.baseCode || parsed.base || newId).trim()
  const version = normalizeVersionLabel(options?.version || parsed.version || '')
  return {
    id: newId,
    baseCode,
    version,
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
    safetyStock: 0,
  }
}
