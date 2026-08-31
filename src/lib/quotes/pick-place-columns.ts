export type PickPlaceColumnMap = {
  designator: number
  layer: number
  package: number
  x: number
  y: number
  value: number
  rotation: number
  description: number
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

function findColumn(header: string[], aliases: string[]) {
  return header.findIndex((cell) => headerMatches(cell, aliases))
}

function findColumnExcluding(header: string[], aliases: string[], used: Set<number>) {
  for (let index = 0; index < header.length; index += 1) {
    if (used.has(index)) continue
    if (headerMatches(header[index] ?? '', aliases)) return index
  }
  return -1
}

function findAllColumns(header: string[], aliases: string[]) {
  const matches: number[] = []
  header.forEach((cell, index) => {
    if (headerMatches(cell, aliases)) matches.push(index)
  })
  return matches
}

function looksLikeDesignatorValue(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return false
  const upper = trimmed.toUpperCase()
  if (/^(REFDES|DESIGNATOR|REFERENCE|COMP|SYM|TOP|BOT|LAYER|X|Y)$/i.test(upper)) return false
  return /^[#@]?[A-Z]{1,6}\d+[A-Z0-9-]*$/i.test(trimmed)
}

function scoreDesignatorColumn(rows: string[][], headerIndex: number, colIndex: number) {
  let hits = 0
  let total = 0
  const end = Math.min(rows.length, headerIndex + 21)
  for (let rowIndex = headerIndex + 1; rowIndex < end; rowIndex += 1) {
    const value = String(rows[rowIndex]?.[colIndex] ?? '').trim()
    if (!value) continue
    total += 1
    if (looksLikeDesignatorValue(value)) hits += 1
  }
  if (!total) return 0
  return hits / total
}

function findDesignatorColumn(header: string[], rows: string[][], headerIndex: number) {
  const candidates = new Set<number>(findAllColumns(header, DESIGNATOR_ALIASES))
  for (let colIndex = 0; colIndex < header.length; colIndex += 1) {
    if (scoreDesignatorColumn(rows, headerIndex, colIndex) >= 0.7) {
      candidates.add(colIndex)
    }
  }

  let bestIndex = -1
  let bestScore = -1
  for (const colIndex of candidates) {
    const headerBoost = headerMatches(header[colIndex] ?? '', DESIGNATOR_ALIASES) ? 0.25 : 0
    const contentScore = scoreDesignatorColumn(rows, headerIndex, colIndex)
    const totalScore = contentScore + headerBoost
    if (totalScore > bestScore) {
      bestScore = totalScore
      bestIndex = colIndex
    }
  }

  return bestIndex
}

const DESIGNATOR_ALIASES = [
  'designator',
  'refdes',
  'ref',
  'reference',
  'partref',
  'posname',
  'partid',
  'refid',
  '부품위치',
  '위치',
  'component',
  'item',
  '부품명',
  '품번',
]

const LAYER_ALIASES = [
  'layer',
  'side',
  'face',
  'topbottom',
  'tb',
  'mountingside',
  'boardside',
  'smtlayer',
  'symmirror',
  'mirror',
  '층',
  '면',
  'topbot',
  'lay',
]

const PACKAGE_ALIASES = [
  'footprint',
  'package',
  'pkg',
  'pattern',
  'landpattern',
  'pad',
  'foot',
  'compdevicet',
  'devicetype',
  'compdevice',
  '패키지',
  '형태',
]

const VALUE_ALIASES = ['comment', 'value', 'partvalue', 'compvalue', 'val', '품값', '부품값']

const X_ALIASES = [
  'centerx',
  'xmm',
  'symx',
  'posx',
  'positionx',
  'coordx',
  'midx',
  'midpointx',
  'xcoord',
  'x좌표',
  'x',
]
const Y_ALIASES = [
  'centery',
  'ymm',
  'symy',
  'posy',
  'positiony',
  'coordy',
  'midy',
  'midpointy',
  'ycoord',
  'y좌표',
  'y',
]

const ROTATION_ALIASES = ['rotation', 'rot', 'angle', 'orient', 'dir', 'symrotate', '회전', '각도']
const DESCRIPTION_ALIASES = ['description', 'desc', 'partname', 'componentname', 'symname', 'name', '부품설명', '설명']

export function detectPickPlaceHeader(rows: string[][]): { headerIndex: number; columns: PickPlaceColumnMap } | null {
  let best: { headerIndex: number; columns: PickPlaceColumnMap; score: number } | null = null

  for (let i = 0; i < rows.length; i += 1) {
    const header = rows[i].map((cell) => String(cell ?? '').trim())
    if (!header.some(Boolean)) continue

    const designator = findDesignatorColumn(header, rows, i)
    const x = findColumn(header, X_ALIASES)
    const y = findColumn(header, Y_ALIASES)
    if (designator < 0 || x < 0 || y < 0) continue

    const designatorScore = scoreDesignatorColumn(rows, i, designator)
    if (designatorScore < 0.35) continue

    const used = new Set([designator, x, y])
    const layer = findColumnExcluding(header, LAYER_ALIASES, used)
    if (layer >= 0) used.add(layer)
    const pkg = findColumnExcluding(header, PACKAGE_ALIASES, used)
    if (pkg >= 0) used.add(pkg)
    const value = findColumnExcluding(header, VALUE_ALIASES, used)
    if (value >= 0) used.add(value)
    const rotation = findColumnExcluding(header, ROTATION_ALIASES, used)
    if (rotation >= 0) used.add(rotation)
    const description = findColumnExcluding(header, DESCRIPTION_ALIASES, used)

    let score = 10 + designatorScore * 4
    if (layer >= 0) score += 3
    if (pkg >= 0) score += 2
    if (value >= 0) score += 2
    if (rotation >= 0) score += 1
    if (description >= 0) score += 1

    const candidate = {
      headerIndex: i,
      columns: {
        designator,
        layer,
        package: pkg,
        x,
        y,
        value,
        rotation,
        description,
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

/** AI 매핑 등으로 일부 컬럼이 비어 있을 때 헤더 alias 규칙으로 보완 */
export function fillMissingPickPlaceColumns(
  header: string[],
  columns: PickPlaceColumnMap,
): PickPlaceColumnMap {
  const used = new Set(
    Object.values(columns).filter((index) => index >= 0),
  )
  const next = { ...columns }

  const fillOptional = (
    key: 'layer' | 'package' | 'value' | 'rotation' | 'description',
    aliases: string[],
  ) => {
    if (next[key] >= 0) return
    const index = findColumnExcluding(header, aliases, used)
    if (index >= 0) {
      next[key] = index
      used.add(index)
    }
  }

  fillOptional('layer', LAYER_ALIASES)
  fillOptional('package', PACKAGE_ALIASES)
  fillOptional('value', VALUE_ALIASES)
  fillOptional('rotation', ROTATION_ALIASES)
  fillOptional('description', DESCRIPTION_ALIASES)

  return next
}

/** @deprecated use parsePickPlaceSide from canonical-pick-place */
export function normalizePickPlaceLayer(value: string, hasLayerColumn: boolean) {
  if (!hasLayerColumn) return 'TopLayer'

  const raw = value.trim().toLowerCase()
  if (!raw) return 'TopLayer'
  if (raw === 't' || raw === '1' || raw === 'top' || raw.includes('top') || raw === 'primary' || raw === '앞') {
    return 'TopLayer'
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
    return 'BottomLayer'
  }
  if (raw.includes('top')) return 'TopLayer'
  if (raw.includes('bot')) return 'BottomLayer'
  return value
}

export function formatPickPlaceColumnMappingNote(header: string[], columns: PickPlaceColumnMap) {
  const labels: string[] = []
  for (const index of [
    columns.designator,
    columns.x,
    columns.y,
    columns.layer,
    columns.package,
    columns.value,
    columns.rotation,
    columns.description,
  ]) {
    if (index < 0) continue
    const label = String(header[index] ?? '').trim()
    if (label && !labels.includes(label)) labels.push(label)
  }
  return `AI 컬럼 매핑: ${labels.join(', ')}`
}

export function formatDetectedColumns(columns: PickPlaceColumnMap, header: string[]) {
  const parts = [
    header[columns.designator] || '?',
    columns.layer >= 0 ? header[columns.layer] : null,
    columns.package >= 0 ? header[columns.package] : null,
    columns.value >= 0 ? header[columns.value] : null,
    header[columns.x],
    header[columns.y],
  ].filter(Boolean)
  return parts.join(', ')
}
