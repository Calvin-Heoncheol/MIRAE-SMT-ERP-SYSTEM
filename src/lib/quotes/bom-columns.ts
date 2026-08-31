import { scoreDesignatorColumn } from '@/lib/quotes/designator-utils'

export type BomColumnMap = {
  designator: number
  comment: number
  footprint: number
  description: number
  quantity: number
  mpn: number
  manufacturer: number
  supplier: number
  supplierPart: number
}

function normalizeHeaderKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/[^\w가-힣]+/g, '')
    .trim()
}

function headerMatches(cell: string, aliases: string[]) {
  const key = normalizeHeaderKey(cell)
  if (!key) return false
  return aliases.some((alias) => {
    if (alias.length <= 2) return key === alias
    return key === alias || key.includes(alias) || alias.includes(key)
  })
}

function findColumnExcluding(header: string[], aliases: string[], used: Set<number>) {
  for (let index = 0; index < header.length; index += 1) {
    if (used.has(index)) continue
    if (headerMatches(header[index] ?? '', aliases)) return index
  }
  return -1
}

const DESIGNATOR_BLOCKED_KEYS = new Set([
  'compvalue',
  'compdevice',
  'compdevicet',
  'compdevicetype',
  'compname',
  'comment',
  'quantity',
  'qty',
  'footprint',
  'package',
  'description',
  'mpn',
  'manufacturer',
  'supplier',
  'symx',
  'symy',
  'symmirror',
  'symrotate',
  'capacitor',
  'resistor',
  'inductor',
  'connector',
  'parttype',
  'category',
  'componenttype',
  'type',
  'lineno',
  'linenumber',
  'itemno',
  'itemnumber',
  'line',
  'no',
  'number',
  'index',
])

function isBlockedBomDesignatorHeader(cell: string) {
  const key = normalizeHeaderKey(cell)
  if (!key) return true
  if (DESIGNATOR_BLOCKED_KEYS.has(key)) return true
  return /^(compvalue|compdevice|compdevicet|compname|symx|symy|symmirror|capacitor|resistor|inductor|parttype|category|lineno|itemno)/.test(
    key,
  )
}

const DESIGNATOR_PRIORITY_ALIASES = [
  'refdes',
  'referencedesignator',
  'references',
  'referencedesignators',
  'partreferences',
  'designator',
  'reference',
  'partref',
  'symref',
  'refid',
  'partreference',
  'designators',
  '부품위치',
  '위치',
  '참조',
]

const DESIGNATOR_FALLBACK_ALIASES = ['posname', 'partid', 'component', 'item', '부품명', '품번']

export function findBomDesignatorColumn(
  header: string[],
  rows?: string[][],
  headerIndex?: number,
) {
  const candidates = new Set<number>()

  for (const aliases of [DESIGNATOR_PRIORITY_ALIASES, DESIGNATOR_FALLBACK_ALIASES]) {
    for (let index = 0; index < header.length; index += 1) {
      const cell = header[index] ?? ''
      if (isBlockedBomDesignatorHeader(cell)) continue
      if (headerMatches(cell, aliases)) candidates.add(index)
    }
  }

  if (rows != null && headerIndex != null) {
    for (let colIndex = 0; colIndex < header.length; colIndex += 1) {
      if (isBlockedBomDesignatorHeader(header[colIndex] ?? '')) continue
      if (scoreDesignatorColumn(rows, headerIndex, colIndex) >= 0.65) {
        candidates.add(colIndex)
      }
    }
  }

  let bestIndex = -1
  let bestScore = -1
  for (const colIndex of candidates) {
    const headerBoost = headerMatches(header[colIndex] ?? '', DESIGNATOR_PRIORITY_ALIASES) ? 0.35 : 0
    const contentScore =
      rows != null && headerIndex != null ? scoreDesignatorColumn(rows, headerIndex, colIndex) : 0
    const totalScore = contentScore + headerBoost
    if (totalScore > bestScore) {
      bestScore = totalScore
      bestIndex = colIndex
    }
  }

  return bestIndex
}

export function fillMissingBomColumns(
  header: string[],
  rows: string[][],
  headerIndex: number,
  columns: BomColumnMap,
): BomColumnMap {
  const next = { ...columns }
  const currentScore =
    next.designator >= 0 ? scoreDesignatorColumn(rows, headerIndex, next.designator) : 0
  if (currentScore < 0.35) {
    const detected = findBomDesignatorColumn(header, rows, headerIndex)
    if (detected >= 0) next.designator = detected
  }

  const used = new Set(Object.values(next).filter((index) => index >= 0))
  const fillOptional = (
    key: 'comment' | 'footprint' | 'description' | 'quantity' | 'mpn' | 'manufacturer' | 'supplier' | 'supplierPart',
    aliases: string[],
  ) => {
    if (next[key] >= 0) return
    const index = findColumnExcluding(header, aliases, used)
    if (index >= 0) {
      next[key] = index
      used.add(index)
    }
  }

  fillOptional('comment', COMMENT_ALIASES)
  fillOptional('footprint', FOOTPRINT_ALIASES)
  fillOptional('description', DESCRIPTION_ALIASES)
  fillOptional('quantity', QUANTITY_ALIASES)
  fillOptional('mpn', MPN_ALIASES)
  fillOptional('manufacturer', MANUFACTURER_ALIASES)
  fillOptional('supplier', SUPPLIER_ALIASES)
  fillOptional('supplierPart', SUPPLIER_PART_ALIASES)

  return next
}

const COMMENT_ALIASES = [
  'comment',
  'value',
  'partvalue',
  'compvalue',
  'val',
  'specification',
  'spec',
  'nominal',
  'rating',
  'libref',
  'libraryreference',
  'libreference',
  'libraryref',
  'component',
  'componentname',
  'part',
  '품값',
  '부품값',
]
const FOOTPRINT_ALIASES = [
  'footprint',
  'package',
  'pkg',
  'pattern',
  'landpattern',
  'pad',
  'foot',
  'compdevicet',
  'compdevice',
  'devicetype',
  'pcblib',
  'pcbfootprint',
  'landpattern',
  '패키지',
  '형태',
]
const DESCRIPTION_ALIASES = [
  'description',
  'desc',
  'partname',
  'componentname',
  'name',
  'componentdescription',
  'parttype',
  'category',
  'device',
  '부품설명',
  '설명',
]
const QUANTITY_ALIASES = ['quantity', 'qty', 'count', 'amount', '수량', '개수', 'pcs']
const MPN_ALIASES = [
  'manufacturerpartnumber',
  'manufacturerpart',
  'mpn',
  'mfrpart',
  'partnumber',
  '제조사품번',
  '제조사부품번호',
]
const MANUFACTURER_ALIASES = ['manufacturer', 'mfr', 'maker', 'vendor', '제조사', '메이커']
const SUPPLIER_ALIASES = ['supplier', 'distributor', '공급사', '업체']
const SUPPLIER_PART_ALIASES = ['supplierpartnumber', 'supplierpart', 'distributorp', '공급사품번']

export function scoreBomHeader(rows: string[][]) {
  const detected = detectBomHeader(rows)
  if (!detected) return 0
  let score = 10
  if (detected.columns.footprint >= 0) score += 2
  if (detected.columns.comment >= 0) score += 1
  if (detected.columns.description >= 0) score += 1
  if (detected.columns.quantity >= 0) score += 1
  if (detected.columns.mpn >= 0) score += 1
  return score
}

export function detectBomHeader(rows: string[][]): { headerIndex: number; columns: BomColumnMap } | null {
  let best: { headerIndex: number; columns: BomColumnMap; score: number } | null = null

  for (let i = 0; i < rows.length; i += 1) {
    const header = rows[i].map((cell) => String(cell ?? '').trim())
    if (!header.some(Boolean)) continue

    const designator = findBomDesignatorColumn(header, rows, i)
    if (designator < 0) continue

    const used = new Set([designator])
    const comment = findColumnExcluding(header, COMMENT_ALIASES, used)
    if (comment >= 0) used.add(comment)
    const footprint = findColumnExcluding(header, FOOTPRINT_ALIASES, used)
    if (footprint >= 0) used.add(footprint)
    const description = findColumnExcluding(header, DESCRIPTION_ALIASES, used)
    if (description >= 0) used.add(description)
    const quantity = findColumnExcluding(header, QUANTITY_ALIASES, used)
    if (quantity >= 0) used.add(quantity)
    const mpn = findColumnExcluding(header, MPN_ALIASES, used)
    if (mpn >= 0) used.add(mpn)
    const manufacturer = findColumnExcluding(header, MANUFACTURER_ALIASES, used)
    if (manufacturer >= 0) used.add(manufacturer)
    const supplier = findColumnExcluding(header, SUPPLIER_ALIASES, used)
    if (supplier >= 0) used.add(supplier)
    const supplierPart = findColumnExcluding(header, SUPPLIER_PART_ALIASES, used)

    if (comment < 0 && footprint < 0 && description < 0 && mpn < 0) continue

    const designatorScore = scoreDesignatorColumn(rows, i, designator)
    if (designatorScore < 0.25) continue

    let score = 10 + designatorScore * 4
    if (footprint >= 0) score += 2
    if (comment >= 0) score += 1
    if (description >= 0) score += 1
    if (quantity >= 0) score += 1
    if (mpn >= 0) score += 1

    const candidate = {
      headerIndex: i,
      columns: {
        designator,
        comment,
        footprint,
        description,
        quantity,
        mpn,
        manufacturer,
        supplier,
        supplierPart,
      },
      score,
    }

    if (!best || candidate.score > best.score) {
      best = candidate
    }
  }

  if (!best) return null
  return { headerIndex: best.headerIndex, columns: best.columns }
}

export function formatBomColumnMappingNote(header: string[], columns: BomColumnMap) {
  const labels: string[] = []
  for (const index of [
    columns.designator,
    columns.footprint,
    columns.comment,
    columns.description,
    columns.quantity,
    columns.mpn,
  ]) {
    if (index < 0) continue
    const label = String(header[index] ?? '').trim()
    if (label && !labels.includes(label)) labels.push(label)
  }
  return `인식된 컬럼: ${labels.join(', ')}`
}

/** @deprecated use formatBomColumnMappingNote */
export function formatBomDetectedColumns(columns: BomColumnMap, header: string[]) {
  const parts = [
    header[columns.designator] || '?',
    columns.footprint >= 0 ? header[columns.footprint] : null,
    columns.comment >= 0 ? header[columns.comment] : null,
    columns.quantity >= 0 ? header[columns.quantity] : null,
    columns.mpn >= 0 ? header[columns.mpn] : null,
  ].filter(Boolean)
  return parts.join(', ')
}
