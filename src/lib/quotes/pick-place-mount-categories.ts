export type PickPlaceMountType = 'smd' | 'dip'

export type PickPlaceSmdCategory = 'chip' | 'ic' | 'bga' | 'odd' | 'special' | 'skip'

export type PickPlaceDipCategory =
  | 'dip_general'
  | 'dip_connector'
  | 'dip_wire'
  | 'wave_general'
  | 'wave_connector'
  | 'wave_wire'

export type PickPlaceComponentCategory = PickPlaceSmdCategory | PickPlaceDipCategory

export type AltiumPickPlaceDipStats = {
  dipGeneral: number
  dipConnector: number
  dipWire: number
  waveGeneral: number
  waveConnector: number
  waveWire: number
}

const DIP_CATEGORIES = new Set<PickPlaceComponentCategory>([
  'dip_general',
  'dip_connector',
  'dip_wire',
  'wave_general',
  'wave_connector',
  'wave_wire',
])

const SMD_FOOTPRINT_HINT =
  /\b(1608|1005|0603|0201|0402|1206|2012|3216|3225|0805|1210|1812|2512|QFP|QFN|BGA|DFN|SOT|SOIC|TQFP|LQFP|VQFP|WSON|SON|CSP|LGA|CHIP|SC0201|SC0402|SC0603|SC0805|SC1206|C_1608|R_1608)\b/i

const THROUGH_HOLE_FOOTPRINT_HINT =
  /\b(PDIP|CDIP|SDIP|EDIP|\d+DIP|DIP\d+|THT|PHT|THRU|THROUGH[- ]?HOLE|PLUGIN|PLUG[- ]?IN|AXIAL|RADIAL|PIN[-_]?HDR|PINHEADER|PIN[-_]?HEADER|HEADER|SOCKET|CONN[-_]?HDR|TO-92|TO-220|TO-252|TO-263|TO-247|SIP[-_]?\d|WIRE(?:WOUND)?|수삽|관통|플러그인)\b/i

const THROUGH_HOLE_DESIGNATOR_HINT = /^(J|P|CN|PL|HDR|SKT|XF|TR|TX|CON)\d/i

export type ThroughHoleDetection = {
  isThroughHole: boolean
  strength: 'none' | 'weak' | 'strong'
}

export function isClearlySmdFootprintText(text: string) {
  return SMD_FOOTPRINT_HINT.test(text)
}

export function detectThroughHoleMount(row: {
  package: string
  description: string
  value: string
  designator: string
}): ThroughHoleDetection {
  const text = `${row.package} ${row.description} ${row.value}`.trim()
  if (text && isClearlySmdFootprintText(text)) {
    return { isThroughHole: false, strength: 'none' }
  }
  if (text && THROUGH_HOLE_FOOTPRINT_HINT.test(text)) {
    return { isThroughHole: true, strength: 'strong' }
  }
  if (THROUGH_HOLE_DESIGNATOR_HINT.test(row.designator.trim())) {
    return { isThroughHole: true, strength: 'weak' }
  }
  return { isThroughHole: false, strength: 'none' }
}

/** @deprecated use detectThroughHoleMount */
const THROUGH_HOLE_HINT = THROUGH_HOLE_FOOTPRINT_HINT

export function emptyPickPlaceDipStats(): AltiumPickPlaceDipStats {
  return {
    dipGeneral: 0,
    dipConnector: 0,
    dipWire: 0,
    waveGeneral: 0,
    waveConnector: 0,
    waveWire: 0,
  }
}

export function isPickPlaceDipCategory(
  category: PickPlaceComponentCategory,
): category is PickPlaceDipCategory {
  return DIP_CATEGORIES.has(category)
}

export function isPickPlaceSmdCategory(
  category: PickPlaceComponentCategory,
): category is PickPlaceSmdCategory {
  return !isPickPlaceDipCategory(category)
}

export function pickPlaceMountTypeForCategory(category: PickPlaceComponentCategory): PickPlaceMountType {
  return isPickPlaceDipCategory(category) ? 'dip' : 'smd'
}

export function pickPlaceCategoryLabel(category: PickPlaceComponentCategory) {
  const match = [...PICK_PLACE_SMD_CATEGORY_OPTIONS, ...PICK_PLACE_DIP_CATEGORY_OPTIONS].find(
    (option) => option.category === category,
  )
  return match?.label ?? category
}

export const PICK_PLACE_SMD_CATEGORY_OPTIONS: Array<{
  category: PickPlaceSmdCategory
  label: string
  hint: string
}> = [
  { category: 'chip', label: 'Chip', hint: 'R/C/L 등 소형 부품' },
  { category: 'ic', label: 'IC', hint: 'IC PIN 집계' },
  { category: 'bga', label: 'BGA', hint: 'BGA BALL 집계' },
  { category: 'odd', label: '이형', hint: '이형 부품' },
  { category: 'special', label: '특수/커넥터', hint: 'SMD 특수·커넥터' },
  { category: 'skip', label: '제외', hint: 'TP·집계 제외' },
]

/** @deprecated use PICK_PLACE_SMD_CATEGORY_OPTIONS */
export const PICK_PLACE_MANUAL_CATEGORY_OPTIONS = PICK_PLACE_SMD_CATEGORY_OPTIONS

export const PICK_PLACE_DIP_CATEGORY_OPTIONS: Array<{
  category: PickPlaceDipCategory
  label: string
  hint: string
  group: 'hand' | 'wave'
}> = [
  { category: 'dip_general', label: '수납땜 소형', hint: '1~3 PIN', group: 'hand' },
  { category: 'dip_connector', label: '수납땜 중형', hint: '4~10 PIN', group: 'hand' },
  { category: 'dip_wire', label: '수납땜 대형', hint: '10 PIN+', group: 'hand' },
  { category: 'wave_general', label: 'WAVE 소형', hint: '1~3 PIN', group: 'wave' },
  { category: 'wave_connector', label: 'WAVE 중형', hint: '4~10 PIN', group: 'wave' },
  { category: 'wave_wire', label: 'WAVE 대형', hint: '10 PIN+', group: 'wave' },
]

function estimatePinCount(footprint: string) {
  const text = footprint.trim()
  if (!text) return 0
  const pinMatch = text.match(/(\d+)\s*PIN\b/i)
  if (pinMatch) return Number(pinMatch[1]) || 0
  const suffixMatch = text.match(/[-_](\d{1,3})(?:PIN|P)?\b/i)
  if (suffixMatch) return Number(suffixMatch[1]) || 0
  return 0
}

type MountSuggestionRow = {
  category: PickPlaceComponentCategory
  package: string
  description: string
  value: string
  designator: string
  detail: string
}

export function suggestPickPlaceMountType(row: MountSuggestionRow): PickPlaceMountType {
  if (isPickPlaceDipCategory(row.category)) return 'dip'
  const detection = detectThroughHoleMount(row)
  if (detection.isThroughHole) return 'dip'
  if (row.detail.includes('수삽') || row.detail.includes('DIP')) return 'dip'
  return 'smd'
}

export function classifyPickPlaceDipFromRow(row: MountSuggestionRow): {
  category: PickPlaceDipCategory
  confidence: 'certain' | 'ambiguous'
  detail: string
} | null {
  if (isPickPlaceDipCategory(row.category)) {
    return {
      category: row.category,
      confidence: 'certain',
      detail: pickPlaceCategoryLabel(row.category),
    }
  }

  const detection = detectThroughHoleMount(row)
  if (!detection.isThroughHole) return null

  const category = suggestPickPlaceDipCategory(row)
  const label = pickPlaceCategoryLabel(category)
  if (detection.strength === 'strong') {
    return { category, confidence: 'certain', detail: `수삽 · ${label}` }
  }
  return { category, confidence: 'ambiguous', detail: `수삽 후보 · ${label}` }
}

export function suggestPickPlaceDipCategory(row: MountSuggestionRow): PickPlaceDipCategory {
  if (isPickPlaceDipCategory(row.category)) return row.category
  const pins = estimatePinCount(row.package)
  if (pins >= 11) return 'dip_wire'
  if (pins >= 4) return 'dip_connector'
  return 'dip_general'
}

export function addPickPlaceDipClassification(
  stats: AltiumPickPlaceDipStats,
  category: PickPlaceDipCategory,
) {
  if (category === 'dip_general') stats.dipGeneral += 1
  else if (category === 'dip_connector') stats.dipConnector += 1
  else if (category === 'dip_wire') stats.dipWire += 1
  else if (category === 'wave_general') stats.waveGeneral += 1
  else if (category === 'wave_connector') stats.waveConnector += 1
  else if (category === 'wave_wire') stats.waveWire += 1
}
