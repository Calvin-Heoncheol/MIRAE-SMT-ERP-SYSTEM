export type PickPlaceSide = 'top' | 'bottom' | 'unknown'

export type CanonicalPickPlaceRow = {
  designator: string
  side: PickPlaceSide
  rawLayer: string
  x: number
  y: number
  package: string
  value: string
  description: string
  rotation: number
  mpn: string
}

export type CanonicalPickPlaceFile = {
  fileName: string
  units: 'mm' | 'mil' | 'unknown'
  rows: CanonicalPickPlaceRow[]
}

export function parsePickPlaceSide(rawLayer: string, hasLayerColumn: boolean): PickPlaceSide {
  if (!hasLayerColumn) return 'top'

  const raw = rawLayer.trim().toLowerCase()
  if (!raw) return 'top'
  if (raw === 't' || raw === '1' || raw === 'top' || raw.includes('top') || raw === 'primary' || raw === '앞') {
    return 'top'
  }
  if (
    raw === 'b' ||
    raw === '2' ||
    raw === 'bot' ||
    raw === 'bottom' ||
    raw.includes('bottom') ||
    raw.includes('bot') ||
    raw === 'secondary' ||
    raw === '뒤'
  ) {
    return 'bottom'
  }
  if (raw.includes('top')) return 'top'
  if (raw.includes('bot')) return 'bottom'
  return 'unknown'
}

export function formatPickPlaceSideLabel(side: PickPlaceSide, rawLayer?: string) {
  if (side === 'top') return 'TOP'
  if (side === 'bottom') return 'BOT'
  return rawLayer?.trim() || '?'
}

/** @deprecated use package */
export function pickPlacePackage(row: PickPlaceRowLike) {
  return row.package || row.footprint || ''
}

/** @deprecated use value */
export function pickPlaceValue(row: PickPlaceRowLike) {
  return row.value || row.comment || ''
}

type PickPlaceRowLike = {
  package?: string
  footprint?: string
  value?: string
  comment?: string
}
