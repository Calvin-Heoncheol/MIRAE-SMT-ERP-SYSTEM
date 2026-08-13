import type { MetalMaskAsset, MetalMaskPcbSide, MetalMaskStatus } from './types'
import { DEFAULT_METAL_MASK_USE_LIMIT, METAL_MASK_WARN_REMAINING } from './types'

export function normalizeMetalMaskBarcode(value: string) {
  return value.trim()
}

export function normalizeMetalMaskPcbSide(value: unknown): MetalMaskPcbSide {
  const raw = String(value || '').trim().toUpperCase()
  if (raw === 'TOP' || raw === 'BOT') return raw
  return 'SINGLE'
}

export function mapMetalMaskAssetRow(row: {
  id: string
  barcode: string
  name: string | null
  item_id?: string | null
  pcb_side: string
  use_limit: number | null
  use_count: number | null
  status: string
  note: string | null
  created_at: string
  updated_at: string
}): MetalMaskAsset {
  const status: MetalMaskStatus = row.status === 'retired' ? 'retired' : 'active'
  return {
    id: row.id,
    barcode: String(row.barcode || '').trim(),
    name: String(row.name || '').trim(),
    itemId: row.item_id ? String(row.item_id).trim() : null,
    pcbSide: normalizeMetalMaskPcbSide(row.pcb_side),
    useLimit: Math.max(1, Math.floor(Number(row.use_limit) || DEFAULT_METAL_MASK_USE_LIMIT)),
    useCount: Math.max(0, Math.floor(Number(row.use_count) || 0)),
    status,
    note: String(row.note || '').trim(),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

export function metalMaskRemaining(asset: Pick<MetalMaskAsset, 'useLimit' | 'useCount'>) {
  return Math.max(0, asset.useLimit - asset.useCount)
}

export function isMetalMaskNearLimit(asset: Pick<MetalMaskAsset, 'useLimit' | 'useCount'>) {
  return metalMaskRemaining(asset) <= METAL_MASK_WARN_REMAINING
}

export function canApplyMetalMaskUsage(
  asset: Pick<MetalMaskAsset, 'useLimit' | 'useCount' | 'status' | 'pcbSide'>,
  pcbSide: MetalMaskPcbSide,
  deltaQty: number,
): { ok: true } | { ok: false; detail: string } {
  if (asset.status !== 'active') {
    return { ok: false, detail: '교체완료(폐기)된 마스크입니다.' }
  }
  if (asset.pcbSide !== pcbSide) {
    return {
      ok: false,
      detail: `이 마스크는 ${asset.pcbSide} 전용입니다. 현재 등록 면은 ${pcbSide} 입니다.`,
    }
  }
  const qty = Math.floor(Number(deltaQty) || 0)
  if (qty < 1) {
    return { ok: false, detail: '사용 수량은 1 이상이어야 합니다.' }
  }
  if (asset.useCount + qty > asset.useLimit) {
    const remaining = metalMaskRemaining(asset)
    return {
      ok: false,
      detail: `마스크 교체 한도 초과입니다. 잔여 ${remaining.toLocaleString('ko-KR')}회 / 한도 ${asset.useLimit.toLocaleString('ko-KR')}회`,
    }
  }
  return { ok: true }
}

export function sortMetalMaskAssets(assets: MetalMaskAsset[]) {
  return [...assets].sort((a, b) => {
    if (a.status !== b.status) return a.status === 'active' ? -1 : 1
    const remainDiff = metalMaskRemaining(a) - metalMaskRemaining(b)
    if (remainDiff !== 0) return remainDiff
    return a.barcode.localeCompare(b.barcode, 'ko')
  })
}
