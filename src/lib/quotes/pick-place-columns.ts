export type PickPlaceColumnMap = {
  designator: number
  layer: number
  package: number
  x: number
  y: number
  value: number
  rotation: number
  description: number
  mpn: number
}

function normalizeHeaderKey(value: string) {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, '')
    .replace(/_/g, '')
    .replace(/[^\w가-힣]+/g, '')
    .trim()
}

function headerMatches(cell: string, aliases: string[]) {
  const key = normalizeHeaderKey(cell)
  if (!key) return false
  // Allegro place.txt의 embedded_layer는 보통 비어 있고, 실제 면 정보는 mirror 컬럼에 있음
  if (key.includes('embedded') && aliases.includes('mirror')) return false
  return aliases.some((alias) => {
    if (alias.length <= 2) return key === alias
    return key === alias || key.includes(alias) || alias.includes(key)
  })
}

function looksLikeLayerSideValue(value: string) {
  const raw = value.trim().toLowerCase()
  if (!raw) return false
  return (
    raw === 'm' ||
    raw === 'mirror' ||
    raw === 'mirrored' ||
    raw === 't' ||
    raw === 'b' ||
    raw === 'top' ||
    raw === 'bot' ||
    raw === 'bottom' ||
    raw === '1' ||
    raw === '2' ||
    raw.includes('top') ||
    raw.includes('bot') ||
    raw === 'primary' ||
    raw === 'secondary' ||
    raw === '앞' ||
    raw === '뒤'
  )
}

/** Allegro mirror(빈칸=TOP, m=BOT)처럼 빈 값도 TOP으로 쓰는 컬럼인지 */
function isMirrorStyleLayerHeader(cell: string) {
  const key = normalizeHeaderKey(cell)
  return key === 'mirror' || key === 'symmirror' || key.endsWith('mirror')
}

function scoreLayerColumnCandidate(
  headerCell: string,
  rows: string[][],
  headerIndex: number,
  colIndex: number,
) {
  const key = normalizeHeaderKey(headerCell)
  let score = 0
  if (isMirrorStyleLayerHeader(headerCell)) score += 8
  else if (key === 'side' || key === 'layer' || key === 'topbottom' || key === 'tb') score += 4
  else if (headerMatches(headerCell, LAYER_ALIASES)) score += 2
  if (key.includes('embedded')) score -= 12

  let topish = 0
  let bottomish = 0
  let other = 0
  const end = Math.min(rows.length, headerIndex + 40)
  for (let rowIndex = headerIndex + 1; rowIndex < end; rowIndex += 1) {
    const value = String(rows[rowIndex]?.[colIndex] ?? '').trim()
    if (!value) {
      if (isMirrorStyleLayerHeader(headerCell)) topish += 1
      continue
    }
    const lower = value.toLowerCase()
    if (
      lower === 'm' ||
      lower === 'mirror' ||
      lower === 'mirrored' ||
      lower === 'b' ||
      lower === 'bot' ||
      lower === 'bottom' ||
      lower === '2' ||
      lower.includes('bot') ||
      lower === 'secondary' ||
      lower === '뒤'
    ) {
      bottomish += 1
    } else if (
      lower === 't' ||
      lower === 'top' ||
      lower === '1' ||
      lower.includes('top') ||
      lower === 'primary' ||
      lower === '앞'
    ) {
      topish += 1
    } else if (looksLikeLayerSideValue(value)) {
      other += 1
    } else {
      other += 1
    }
  }

  if (bottomish > 0 && topish > 0) score += 20
  else if (bottomish > 0) score += 12
  else if (topish > 0) score += 3
  score -= other
  return score
}

/** 여러 layer 후보 중 mirror 등 실제 면 신호가 있는 컬럼을 고른다 */
export function preferBestPickPlaceLayerColumn(
  header: string[],
  rows: string[][],
  headerIndex: number,
  currentLayer: number,
  used: Set<number>,
) {
  const candidates = new Set<number>()
  if (currentLayer >= 0) candidates.add(currentLayer)
  for (let index = 0; index < header.length; index += 1) {
    if (used.has(index) && index !== currentLayer) continue
    if (headerMatches(header[index] ?? '', LAYER_ALIASES) || isMirrorStyleLayerHeader(header[index] ?? '')) {
      candidates.add(index)
    }
  }
  // AI가 embedded_layer를 골랐어도 mirror 후보를 다시 넣는다
  for (let index = 0; index < header.length; index += 1) {
    if (used.has(index) && index !== currentLayer) continue
    if (isMirrorStyleLayerHeader(header[index] ?? '')) candidates.add(index)
  }

  let bestIndex = currentLayer
  let bestScore = currentLayer >= 0 ? scoreLayerColumnCandidate(header[currentLayer] ?? '', rows, headerIndex, currentLayer) : -999
  for (const index of candidates) {
    const score = scoreLayerColumnCandidate(header[index] ?? '', rows, headerIndex, index)
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
  }
  return bestIndex
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
  if (/^(REFDES|DESIGNATOR|REFERENCE|COMP|SYM|TOP|BOT|LAYER|X|Y|MIRROR)$/i.test(upper)) return false
  // R1 / C10 / U3A — 또는 Allegro 멀티보드 1C29 / 2R10
  return /^[#@]?(?:\d{1,3})?[A-Z]{1,6}\d+[A-Z0-9-]*$/i.test(trimmed)
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
  'symbolname',
  'symbol',
  '패키지',
  '형태',
]

const VALUE_ALIASES = ['comment', 'value', 'partvalue', 'compvalue', 'val', '품값', '부품값']

const X_ALIASES = [
  'centerx',
  'xmm',
  'symbolx',
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
  'symboly',
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

const ROTATION_ALIASES = ['rotation', 'rot', 'angle', 'orient', 'dir', 'symrotate', 'symrotation', '회전', '각도']
const DESCRIPTION_ALIASES = ['description', 'desc', 'partname', 'componentname', 'name', '부품설명', '설명']

const MPN_ALIASES = [
  'mpn',
  'manufacturerpartnumber',
  'manufacturerpn',
  'mfrpartnumber',
  'mfrpn',
  'partnumber',
  'partno',
  'partnum',
  'pn',
  'itemnumber',
  '제조사품번',
  '품번',
  '부품번호',
]

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
    const layerGuess = findColumnExcluding(header, LAYER_ALIASES, used)
    const layer = preferBestPickPlaceLayerColumn(header, rows, i, layerGuess, used)
    if (layer >= 0) used.add(layer)
    const pkg = findColumnExcluding(header, PACKAGE_ALIASES, used)
    if (pkg >= 0) used.add(pkg)
    const value = findColumnExcluding(header, VALUE_ALIASES, used)
    if (value >= 0) used.add(value)
    const rotation = findColumnExcluding(header, ROTATION_ALIASES, used)
    if (rotation >= 0) used.add(rotation)
    const description = findColumnExcluding(header, DESCRIPTION_ALIASES, used)
    if (description >= 0) used.add(description)
    const mpn = findColumnExcluding(header, MPN_ALIASES, used)

    let score = 10 + designatorScore * 4
    if (layer >= 0) score += 3
    if (pkg >= 0) score += 2
    if (value >= 0) score += 2
    if (rotation >= 0) score += 1
    if (description >= 0) score += 1
    if (mpn >= 0) score += 1

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
        mpn,
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
  rows: string[][] = [],
  headerIndex = 0,
): PickPlaceColumnMap {
  const used = new Set(
    Object.values(columns).filter((index) => index >= 0),
  )
  const next = { ...columns }

  const fillOptional = (
    key: 'layer' | 'package' | 'value' | 'rotation' | 'description' | 'mpn',
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
  next.layer = preferBestPickPlaceLayerColumn(header, rows, headerIndex, next.layer, used)
  if (next.layer >= 0) used.add(next.layer)
  fillOptional('package', PACKAGE_ALIASES)
  fillOptional('value', VALUE_ALIASES)
  fillOptional('rotation', ROTATION_ALIASES)
  fillOptional('description', DESCRIPTION_ALIASES)
  fillOptional('mpn', MPN_ALIASES)

  return next
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
    columns.mpn,
  ]) {
    if (index < 0) continue
    const label = String(header[index] ?? '').trim()
    if (label && !labels.includes(label)) labels.push(label)
  }
  return `AI 컬럼 매핑: ${labels.join(', ')}`
}

