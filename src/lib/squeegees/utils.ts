import type { SqueegeeAsset, SqueegeeStatus } from './types'
import { DEFAULT_SQUEEGEE_USE_LIMIT, SQUEEGEE_WARN_REMAINING } from './types'

export function normalizeSqueegeeBarcode(value: string) {
  return value.trim()
}

export function mapSqueegeeAssetRow(row: {
  id: string
  barcode: string
  name: string | null
  use_limit: number | null
  use_count: number | null
  status: string
  note: string | null
  created_at: string
  updated_at: string
}): SqueegeeAsset {
  const status: SqueegeeStatus = row.status === 'retired' ? 'retired' : 'active'
  return {
    id: row.id,
    barcode: String(row.barcode || '').trim(),
    name: String(row.name || '').trim(),
    useLimit: Math.max(1, Math.floor(Number(row.use_limit) || DEFAULT_SQUEEGEE_USE_LIMIT)),
    useCount: Math.max(0, Math.floor(Number(row.use_count) || 0)),
    status,
    note: String(row.note || '').trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function squeegeeRemaining(asset: Pick<SqueegeeAsset, 'useLimit' | 'useCount'>) {
  return Math.max(0, asset.useLimit - asset.useCount)
}

export function isSqueegeeNearLimit(asset: Pick<SqueegeeAsset, 'useLimit' | 'useCount'>) {
  return squeegeeRemaining(asset) <= SQUEEGEE_WARN_REMAINING
}

export function canApplySqueegeeUsage(
  asset: Pick<SqueegeeAsset, 'useLimit' | 'useCount' | 'status'>,
  deltaQty: number,
): { ok: true } | { ok: false; detail: string } {
  if (asset.status !== 'active') {
    return { ok: false, detail: '교체완료(폐기)된 스퀴즈입니다.' }
  }
  const qty = Math.floor(Number(deltaQty) || 0)
  if (qty < 1) {
    return { ok: false, detail: '사용 수량은 1 이상이어야 합니다.' }
  }
  if (asset.useCount + qty > asset.useLimit) {
    const remaining = squeegeeRemaining(asset)
    return {
      ok: false,
      detail: `스퀴즈 교체 한도 초과입니다. 잔여 ${remaining.toLocaleString('ko-KR')}회 / 한도 ${asset.useLimit.toLocaleString('ko-KR')}회`,
    }
  }
  return { ok: true }
}

export function sortSqueegeeAssets(assets: SqueegeeAsset[]) {
  return [...assets].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    const remainDiff = squeegeeRemaining(a) - squeegeeRemaining(b)
    if (remainDiff !== 0) return remainDiff
    return a.barcode.localeCompare(b.barcode, 'ko')
  })
}
