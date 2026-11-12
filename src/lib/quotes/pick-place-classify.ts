import {
  classifyPickPlaceDipFromRow,
  isPickPlaceSmdCategory,
  pickPlaceCategoryLabel,
  type PickPlaceComponentCategory,
} from '@/lib/quotes/pick-place-mount-categories'
import type { CanonicalPickPlaceRow } from '@/lib/quotes/canonical-pick-place'
import type { PickPlaceClassifiedRow, PickPlaceConfidence } from './pick-place-types'

export type Classification = {
  category: PickPlaceComponentCategory
  categoryLabel: string
  confidence: PickPlaceConfidence
  detail: string
  icPins: number
  bgaBalls: number
  countsTowardParts: boolean
}

const CHIP_DESIGNATORS = /^[RCBLF]/i
const PASSIVE_FOOTPRINT =
  /1608|1005|0603|2012|3216|3225|0402|0201|1206|1812|2512|1210|C_1608|R_1608|R_2012|C_2012|C3225|LPS|SOD|FUS|BEAD|SC0201|SC0402|SC0603|SC0805|SC1206/i

export function pinCountFromFootprint(footprint: string): { pins: number; confidence: PickPlaceConfidence; note: string } {
  const fp = footprint.trim()
  const fpUpper = fp.toUpperCase()

  const suffix = fp.match(/-(\d+)N\b/i)
  if (suffix) {
    return { pins: Math.max(0, Number(suffix[1]) || 0), confidence: 'certain', note: `${suffix[1]}핀` }
  }

  const qfp = fp.match(/(\d+)(?:LQFP|VQFPN|VFQFPN|TQFP|QFP)/i)
  if (qfp) {
    return { pins: Math.max(0, Number(qfp[1]) || 0), confidence: 'certain', note: `QFP ${qfp[1]}핀` }
  }

  if (/^DBV/i.test(fp) || /DBV\d{4}/i.test(fp)) {
    return { pins: 5, confidence: 'certain', note: 'SOT-23-5' }
  }
  if (/^DGK/i.test(fp)) {
    return { pins: 8, confidence: 'certain', note: 'MSOP-8 (DGK)' }
  }
  if (/^SO8/i.test(fp) || /^SOIC.*8/i.test(fpUpper)) {
    return { pins: 8, confidence: 'certain', note: 'SO-8' }
  }
  if (/SOT23-6/i.test(fp)) {
    return { pins: 6, confidence: 'certain', note: 'SOT-23-6' }
  }
  if (/SOT65P220X100-3/i.test(fp)) {
    return { pins: 3, confidence: 'certain', note: 'SOT-3' }
  }
  if (/FP-MSE-12-05/i.test(fp)) {
    return { pins: 8, confidence: 'certain', note: 'DC-DC 8핀' }
  }
  if (/TXB_IC/i.test(fp)) {
    return { pins: 8, confidence: 'certain', note: 'IC 8핀' }
  }
  if (/ATS8001|ATS7001/i.test(fp)) {
    return { pins: 8, confidence: 'certain', note: '전원 IC 8핀' }
  }

  const sot = fp.match(/SOT23-(\d+)/i)
  if (sot) return { pins: Math.max(0, Number(sot[1]) || 0), confidence: 'certain', note: `SOT-23-${sot[1]}` }
  const so = fp.match(/SO(\d+)_/i)
  if (so) return { pins: Math.max(0, Number(so[1]) || 0), confidence: 'certain', note: `SO-${so[1]}` }
  if (/SOT/i.test(fp)) return { pins: 3, confidence: 'certain', note: 'SOT-3' }

  return { pins: 8, confidence: 'ambiguous', note: 'IC · 핀수 추정' }
}

export function extractPcbName(text: string, fileName?: string) {
  const boardRev = text.match(/BDA-V\d+\.\d+/i)
  if (boardRev?.[0]) return { name: boardRev[0], confidence: 'certain' as const }

  if (fileName) {
    const stem = fileName.replace(/\.[^.]+$/, '').trim()
    if (stem) return { name: stem, confidence: 'certain' as const }
  }

  const fromPickPlaceParent =
    text.match(/\\([^\\]+)\\Pick Place\\/i) || text.match(/\/([^/]+)\/Pick Place\//i)
  if (fromPickPlaceParent?.[1] && !/^output file$/i.test(fromPickPlaceParent[1])) {
    return { name: fromPickPlaceParent[1].trim(), confidence: 'ambiguous' as const }
  }

  return { name: 'PCB', confidence: 'ambiguous' as const }
}

export function extractUnits(text: string, headerRow?: string[]): 'mm' | 'mil' | 'unknown' {
  if (/Units used:\s*mm/i.test(text) || /\bUUNITS\s*=\s*MM\b/i.test(text)) return 'mm'
  if (
    /Units used:\s*mils?/i.test(text) ||
    /\bUUNITS\s*=\s*MILS?\b/i.test(text) ||
    /\bin\s+mils?\b/i.test(text)
  ) {
    return 'mil'
  }
  if (headerRow?.some((cell) => /\(mm\)/i.test(cell) || /mm$/i.test(cell.trim()))) return 'mm'
  if (headerRow?.some((cell) => /\(mil/i.test(cell) || /mils?$/i.test(cell.trim()))) return 'mil'
  return 'unknown'
}

/** Allegro 등 멀티보드 접두(1C29 → C29)를 제거한 designator */
function designatorClassKey(designator: string) {
  return designator.trim().toUpperCase().replace(/^\d{1,3}(?=[A-Z])/, '')
}

export function milToMm(value: number) {
  return value * 0.0254
}

export function cellAt(cells: string[], index: number) {
  return index >= 0 ? cells[index] || '' : ''
}

export function bgaBallCountFromFootprint(footprint: string, description: string) {
  const text = `${footprint} ${description}`
  const direct = text.match(/BGA[^0-9]*(\d{2,4})/i)
  if (direct) {
    return {
      balls: Math.max(0, Number(direct[1]) || 0),
      confidence: 'certain' as const,
      note: `BGA ${direct[1]}볼`,
    }
  }
  return { balls: 0, confidence: 'ambiguous' as const, note: 'BGA · 볼수 확인' }
}

export function classifyComponent(row: CanonicalPickPlaceRow): Classification {
  const des = designatorClassKey(row.designator)
  const fp = row.package.trim()
  const val = row.value.trim()
  const desc = row.description.trim()
  const fpUpper = fp.toUpperCase()
  const valUpper = val.toUpperCase()
  const descUpper = desc.toUpperCase()
  const textUpper = `${fpUpper} ${valUpper} ${descUpper}`

  if (!des) {
    return {
      category: 'skip',
      categoryLabel: '제외',
      confidence: 'certain',
      detail: '빈 Designator',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: false,
    }
  }
  if (des === 'GND' || des === 'UGND' || des === 'ADGND') {
    return {
      category: 'skip',
      categoryLabel: '제외',
      confidence: 'certain',
      detail: '접지패드 (제외)',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: false,
    }
  }
  if (des.startsWith('TP') || fpUpper.startsWith('TP')) {
    return {
      category: 'skip',
      categoryLabel: '제외',
      confidence: 'certain',
      detail: '테스트포인트 (제외)',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: false,
    }
  }

  const dipClassification = classifyPickPlaceDipFromRow({
    category: 'chip',
    package: fp,
    description: desc,
    value: val,
    designator: des,
    detail: '',
  })
  if (dipClassification) {
    return {
      category: dipClassification.category,
      categoryLabel: pickPlaceCategoryLabel(dipClassification.category),
      confidence: dipClassification.confidence,
      detail: dipClassification.detail,
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (fpUpper.includes('BGA') || descUpper.includes('BGA') || valUpper.includes('BGA')) {
    const bga = bgaBallCountFromFootprint(fp, desc)
    return {
      category: 'bga',
      categoryLabel: 'BGA',
      confidence: bga.confidence,
      detail: bga.note,
      icPins: 0,
      bgaBalls: bga.balls > 0 ? bga.balls : 1,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('U')) {
    const pin = pinCountFromFootprint(fp)
    return {
      category: 'ic',
      categoryLabel: 'IC',
      confidence: pin.confidence,
      detail: pin.note,
      icPins: pin.pins,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (
    des.startsWith('H') ||
    des.startsWith('CON') ||
    des.startsWith('PS') ||
    descUpper.includes('HEADER') ||
    descUpper.includes('CONN') ||
    descUpper.includes('SOCKET')
  ) {
    return {
      category: 'special',
      categoryLabel: '특수/커넥터',
      confidence: 'ambiguous',
      detail: '커넥터 · SMD/수삽?',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('V') && (des.includes('+') || des.includes('-') || des.includes('GND'))) {
    return {
      category: 'special',
      categoryLabel: '특수/커넥터',
      confidence: 'ambiguous',
      detail: '전원패드 · 실장/제외?',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('Q')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: 'MOSFET/트랜지스터',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('D') && descUpper.includes('LED')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: 'LED',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('D') || fpUpper.includes('SOD') || textUpper.includes('DIODE')) {
    return {
      category: 'chip',
      categoryLabel: 'Chip',
      confidence: 'certain',
      detail: '다이오드',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('OC') || descUpper.includes('OPTO') || descUpper.includes('PHOTOCOUPLER')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: '광절연(옵토커플러)',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('Y') || des.startsWith('XTAL') || descUpper.includes('CRYSTAL') || descUpper.includes('OSC')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: '크리스탈·발진기',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('SW') || descUpper.includes('SWITCH')) {
    return {
      category: 'odd',
      categoryLabel: '이형',
      confidence: 'certain',
      detail: '스위치',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (des.startsWith('NTC') || des.startsWith('RT') || descUpper.includes('THERMISTOR')) {
    return {
      category: 'chip',
      categoryLabel: 'Chip',
      confidence: 'certain',
      detail: 'NTC·서미스터',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (CHIP_DESIGNATORS.test(des) || PASSIVE_FOOTPRINT.test(fp) || PASSIVE_FOOTPRINT.test(val)) {
    return {
      category: 'chip',
      categoryLabel: 'Chip',
      confidence: 'certain',
      detail: CHIP_DESIGNATORS.test(des) ? 'R/C/L (위치명)' : '패시브 (풋프린트)',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  if (CHIP_DESIGNATORS.test(des)) {
    return {
      category: 'chip',
      categoryLabel: 'Chip',
      confidence: 'certain',
      detail: '패시브',
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }

  return {
    category: 'chip',
    categoryLabel: 'Chip',
    confidence: 'ambiguous',
    detail: '분류 불명',
    icPins: 0,
    bgaBalls: 0,
    countsTowardParts: true,
  }
}

export function classifyPickPlaceRow(
  row: CanonicalPickPlaceRow,
  options?: { hasLayerColumn?: boolean },
): PickPlaceClassifiedRow {
  const classified = classifyComponent(row)
  return applyAutoClassificationReviewGates(
    {
      ...row,
      category: classified.category,
      categoryLabel: classified.categoryLabel,
      confidence: classified.confidence,
      detail: classified.detail,
    },
    options,
  )
}

export function classificationForStats(row: PickPlaceClassifiedRow): Classification {
  return classificationFromExistingRow(row)
}

/**
 * SET-UP 종수 키: 같은 부품값/품번 = 1종.
 * 자동 확정은 MPN 또는 (부품값+패키지)만 허용 — 그 외는 사람 검토.
 */
export function pickPlacePartTypeIdentity(row: PickPlaceClassifiedRow): {
  key: string
  certain: boolean
  reason?: string
} {
  const mpn = row.mpn.trim().toUpperCase()
  if (mpn) return { key: `mpn:${mpn}`, certain: true }

  const value = row.value.trim().toUpperCase()
  const pkg = row.package.trim().toUpperCase()
  if (value && pkg) return { key: `vp:${value}|${pkg}`, certain: true }

  if (value) {
    return {
      key: `v:${value}`,
      certain: false,
      reason: '패키지 없음 — 부품값만으로는 종수 확정 불가',
    }
  }
  if (pkg) {
    return {
      key: `p:${pkg}|${row.designator.trim().toUpperCase()}`,
      certain: false,
      reason: '부품값·품번 없음 — 종수 확인 필요',
    }
  }
  return {
    key: `des:${row.designator.trim().toUpperCase()}`,
    certain: false,
    reason: '부품값·품번·패키지 없음 — 종수 확인 필요',
  }
}

export function appendPickPlaceReviewDetail(detail: string, reason: string) {
  if (!reason) return detail
  if (detail.includes(reason)) return detail
  return detail ? `${detail} · ${reason}` : reason
}

/**
 * 자동 분류에서 불확실한 항목은 집계하지 않고 사람 검토로 넘긴다.
 * (수동/AI/DigiKey 확정 후에는 reviewSource가 있어 이 게이트를 건너뛴다)
 */
export function applyAutoClassificationReviewGates(
  row: PickPlaceClassifiedRow,
  options?: { hasLayerColumn?: boolean },
): PickPlaceClassifiedRow {
  if (row.category === 'skip') return row
  if (row.reviewSource) return row

  let confidence = row.confidence
  let detail = row.detail
  const hasLayerColumn = options?.hasLayerColumn ?? true

  if (!row.designator.trim()) {
    confidence = 'ambiguous'
    detail = appendPickPlaceReviewDetail(detail, 'Designator 없음')
  }

  const identity = pickPlacePartTypeIdentity(row)
  // MPN 없음은 DigiKey 힌트. 종수(MPN 또는 값+패키지)가 확정되면 적용을 막지 않는다.
  if (!row.mpn.trim()) {
    detail = appendPickPlaceReviewDetail(detail, 'MPN 없음')
    if (!identity.certain) {
      confidence = 'ambiguous'
    }
  }

  if (hasLayerColumn && row.side === 'unknown') {
    confidence = 'ambiguous'
    detail = appendPickPlaceReviewDetail(detail, '면 불명?')
  }

  // SMD 종수: MPN이 있어도 부품값·패키지가 부족하면 자동 확정 금지
  if (isPickPlaceSmdCategory(row.category)) {
    if (!identity.certain) {
      confidence = 'ambiguous'
      const reason = identity.reason ?? '종수 확인 필요'
      if (!detail.includes(reason) && !detail.includes('종수 확인')) {
        detail = appendPickPlaceReviewDetail(detail, reason)
      }
    }
  }

  return { ...row, confidence, detail }
}

export function classificationFromExistingRow(row: PickPlaceClassifiedRow): Classification {
  if (row.category === 'skip') {
    return {
      category: 'skip',
      categoryLabel: row.categoryLabel,
      confidence: row.confidence,
      detail: row.detail,
      icPins: 0,
      bgaBalls: 0,
      countsTowardParts: false,
    }
  }
  if (row.category === 'ic') {
    const pin = pinCountFromFootprint(row.package)
    return {
      category: 'ic',
      categoryLabel: row.categoryLabel,
      confidence: row.confidence,
      detail: row.detail,
      icPins: pin.pins > 0 ? pin.pins : 1,
      bgaBalls: 0,
      countsTowardParts: true,
    }
  }
  if (row.category === 'bga') {
    const bga = bgaBallCountFromFootprint(row.package, row.description)
    return {
      category: 'bga',
      categoryLabel: row.categoryLabel,
      confidence: row.confidence,
      detail: row.detail,
      icPins: 0,
      bgaBalls: bga.balls > 0 ? bga.balls : 1,
      countsTowardParts: true,
    }
  }
  return {
    category: row.category,
    categoryLabel: row.categoryLabel,
    confidence: row.confidence,
    detail: row.detail,
    icPins: 0,
    bgaBalls: 0,
    countsTowardParts: true,
  }
}
