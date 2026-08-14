import { sanitizeBarcodeRawInput } from '@/lib/materials/utils'

const GS = '\x1d'

export type ParsedReelBarcode = {
  vendorLot: string
  serial: string
  quantity: number | null
  /** 릴을 구분할 수 있는 값. 없으면 같은 MPN 재스캔을 허용 */
  fingerprint: string
}

function takeGs1Field(text: string, ai: string) {
  const pattern = new RegExp(`(?:^|${GS})${ai}([^${GS}]+)`, 'i')
  const match = pattern.exec(text)
  return match?.[1]?.trim() || ''
}

function takeConcatenatedField(text: string, ai: string, nextAis: string[]) {
  const next = nextAis.map((item) => item.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')
  const pattern = new RegExp(`(?:^|[^0-9A-Za-z])${ai}([A-Za-z0-9.\\-/_]{2,32})(?:${next}|$)`, 'i')
  const match = pattern.exec(text)
  return match?.[1]?.trim() || ''
}

function parseQuantity(value: string) {
  const digits = value.replace(/[^\d]/g, '')
  if (!digits || digits.length > 7) return null
  const qty = Number(digits)
  return qty > 0 ? qty : null
}

/** 릴 바코드에서 제조 LOT·시리얼·수량을 뽑는다. */
export function parseReelBarcode(raw: string): ParsedReelBarcode {
  const text = sanitizeBarcodeRawInput(raw).replace(/^\][A-Za-z0-9]{2}/, '')
  if (!text) {
    return { vendorLot: '', serial: '', quantity: null, fingerprint: '' }
  }

  const hasGs = text.includes(GS)
  const vendorLot = hasGs
    ? takeGs1Field(text, '10')
    : takeConcatenatedField(text, '10', ['11', '17', '21', '30', '1P', '30P'])
  const serial = hasGs
    ? takeGs1Field(text, '21')
    : takeConcatenatedField(text, '21', ['10', '11', '17', '30', '1P', '30P'])
  const qtyRaw = hasGs
    ? takeGs1Field(text, '30') || takeGs1Field(text, 'Q')
    : takeConcatenatedField(text, '30', ['10', '11', '17', '21', '1P', '30P'])
  const quantity = parseQuantity(qtyRaw)

  const compact = text.toLowerCase()
  let fingerprint = ''
  if (serial) fingerprint = `s:${serial.toLowerCase()}`
  else if (compact.length >= 20) fingerprint = `b:${compact}`
  else if (vendorLot && compact.length >= 12 && compact !== vendorLot.toLowerCase()) {
    fingerprint = `b:${compact}`
  }

  return { vendorLot, serial, quantity, fingerprint }
}

export function generateMaterialReelLot(inboundDate: string, existingLots: string[]) {
  const compactDate = inboundDate.replace(/-/g, '')
  const yymmdd = compactDate.length >= 8 ? compactDate.slice(2, 8) : compactDate
  const prefix = `MRL-${yymmdd}-`
  let max = 0
  for (const lot of existingLots) {
    if (!lot.startsWith(prefix)) continue
    const num = Number(lot.slice(prefix.length))
    if (Number.isFinite(num) && num > max) max = num
  }
  return `${prefix}${String(max + 1).padStart(4, '0')}`
}

/** 릴마다 고유 LOT. 제조 LOT는 화면에 따로 보여 준다. */
export function assignReelLotNumber(inboundDate: string, existingLots: string[]) {
  return generateMaterialReelLot(inboundDate, existingLots)
}

export function alreadyScannedReelMessage(lotNumber: string) {
  return `이미 스캔한 릴입니다. (LOT ${lotNumber})`
}

export function isMissingInboundLotColumn(detail: string) {
  const lower = detail.toLowerCase()
  return (
    lower.includes('lot_number') ||
    lower.includes('scan_fingerprint') ||
    (lower.includes('schema cache') && lower.includes('lot'))
  )
}
