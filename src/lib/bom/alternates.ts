import { formatBomItemCode, resolveBomChildItem } from '@/lib/bom/utils'
import type { Item } from '@/lib/items/types'
import { normalizeAlternateMpns } from '@/lib/items/utils'

/** 대체 열 토큰 분리 — 쉼표/슬래시/세미콜론/파이프 */
export function splitBomAlternateTokens(value: string): string[] {
  return String(value || '')
    .split(/[,;/|]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function joinBomAlternateTokens(tokens: string[]): string {
  return [...new Set(tokens.map((token) => token.trim()).filter(Boolean))].join(', ')
}

export type ResolveBomAlternatesResult = {
  alternateChildProductIds: string[]
  /** 주자재(같은 품목)에 붙일 대체 MPN */
  alternateMpnsForPrimary: string[]
  unresolvedTokens: string[]
}

/**
 * 대체 열 해석
 * - 다른 품목코드/다른 품목 → alternateChildProductIds
 * - 같은 품목의 다른 MPN(또는 미등록 MPN) → alternateMpnsForPrimary
 */
export function resolveBomAlternates(
  primary: Item | null,
  alternatesText: string,
  childItems: Item[],
): ResolveBomAlternatesResult {
  const alternateChildProductIds: string[] = []
  const alternateMpnsForPrimary: string[] = []
  const unresolvedTokens: string[] = []
  const seenChild = new Set<string>()
  const seenMpn = new Set<string>()

  const primaryMpn = primary?.mpn.trim().toLowerCase() || ''
  const primaryCode = primary ? formatBomItemCode(primary).toLowerCase() : ''

  for (const token of splitBomAlternateTokens(alternatesText)) {
    const lower = token.toLowerCase()
    if (primary && (lower === primaryMpn || lower === primaryCode || lower === primary.id.toLowerCase())) {
      continue
    }

    const matched = resolveBomChildItem(token, childItems)
    if (matched) {
      if (primary && matched.id === primary.id) {
        // 같은 품목 · 다른 MPN 표기
        if (lower !== primaryMpn && !seenMpn.has(lower)) {
          seenMpn.add(lower)
          alternateMpnsForPrimary.push(token)
        }
        continue
      }
      if (!seenChild.has(matched.id)) {
        seenChild.add(matched.id)
        alternateChildProductIds.push(matched.id)
      }
      continue
    }

    // 미등록 토큰 — 주자재가 있으면 대체 MPN으로, 없으면 미해결
    if (primary) {
      if (!seenMpn.has(lower)) {
        seenMpn.add(lower)
        alternateMpnsForPrimary.push(token)
      }
    } else {
      unresolvedTokens.push(token)
    }
  }

  return {
    alternateChildProductIds,
    alternateMpnsForPrimary: normalizeAlternateMpns(
      alternateMpnsForPrimary,
      primary?.mpn || '',
    ),
    unresolvedTokens,
  }
}

/** 표시용 — 저장된 스냅샷 우선, 없으면 대체 품목코드 조합 */
export function formatBomAlternatesDisplay(
  sourceAlternates: string,
  alternateChildProductIds: string[],
  childItems: Item[],
): string {
  const snapshot = sourceAlternates.trim()
  if (snapshot) return snapshot

  const codes = alternateChildProductIds
    .map((id) => {
      const item = childItems.find((row) => row.id === id)
      return item ? formatBomItemCode(item) : id
    })
    .filter(Boolean)
  return joinBomAlternateTokens(codes)
}
