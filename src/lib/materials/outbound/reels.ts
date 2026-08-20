import { parseReelBarcode } from '@/lib/materials/inbound/reel-lot'
import { sanitizeBarcodeRawInput } from '@/lib/materials/utils'

export type MaterialReelRow = {
  id: string
  materialId: string
  quantity: number
  remainingQty: number
  lotNumber: string
  scanFingerprint: string
  locationStatus: 'warehouse' | 'line'
  inboundDate: string
  createdAt: string
}

export function isMissingReelRemainingColumn(detail: string) {
  const lower = detail.toLowerCase()
  return (
    lower.includes('remaining_qty') ||
    lower.includes('location_status') ||
    lower.includes('inbound_line_id') ||
    (lower.includes('restock') && lower.includes('outbound_type'))
  )
}

export const REEL_MIGRATION_HINT =
  '릴 원장 컬럼이 없습니다. Supabase SQL Editor에서 supabase/migrate-material-reel-remaining.sql 을 실행해 주세요.'

function scanKeys(raw: string) {
  const text = sanitizeBarcodeRawInput(raw).trim()
  const parsed = parseReelBarcode(text)
  const compact = text.toLowerCase()
  const keys = new Set<string>()
  if (text) keys.add(text.toLowerCase())
  if (parsed.vendorLot) keys.add(parsed.vendorLot.toLowerCase())
  if (parsed.serial) keys.add(parsed.serial.toLowerCase())
  if (parsed.fingerprint) keys.add(parsed.fingerprint.toLowerCase())
  if (compact) keys.add(compact)
  return { text, parsed, keys }
}

/** LOT·지문·바코드로 맞는 릴 */
export function findReelsByScan(reels: MaterialReelRow[], raw: string): MaterialReelRow[] {
  const { parsed, keys } = scanKeys(raw)
  if (!keys.size) return []

  return reels.filter((reel) => {
    const lot = reel.lotNumber.trim().toLowerCase()
    const finger = reel.scanFingerprint.trim().toLowerCase()
    if (lot && keys.has(lot)) return true
    if (finger && (keys.has(finger) || finger === parsed.fingerprint.toLowerCase())) return true
    return false
  })
}

export function pickFefoWarehouseReel(
  reels: MaterialReelRow[],
  materialId: string,
): MaterialReelRow | null {
  const id = materialId.trim()
  const warehouse = reels
    .filter(
      (reel) =>
        reel.materialId === id &&
        reel.locationStatus === 'warehouse' &&
        reel.remainingQty > 0,
    )
    .sort((a, b) => {
      const dateCompare = a.inboundDate.localeCompare(b.inboundDate)
      if (dateCompare !== 0) return dateCompare
      return a.createdAt.localeCompare(b.createdAt)
    })
  return warehouse[0] ?? null
}
