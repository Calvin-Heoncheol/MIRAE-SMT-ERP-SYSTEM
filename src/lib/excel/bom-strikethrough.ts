type CfbModule = {
  CFB: {
    read: (data: Uint8Array, opts: { type: 'array' }) => CfbContainer
    find: (cfb: CfbContainer, path: string) => CfbEntry | null
  }
}

type CfbContainer = object
type CfbEntry = { content?: Uint8Array }

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
}

function readCfbEntry(cfb: CfbContainer, XLSX: CfbModule, path: string) {
  const entry = XLSX.CFB.find(cfb, path)
  if (!entry?.content?.length) return ''
  return decodeUtf8(entry.content)
}

function parseStrikeStyleIndices(stylesXml: string) {
  const strikeFontIds = new Set<number>()
  const fontsMatch = stylesXml.match(/<fonts\b[^>]*>([\s\S]*?)<\/fonts>/)
  if (fontsMatch) {
    const fontBlocks = fontsMatch[1].match(/<font\b[\s\S]*?(?:\/>|<\/font>)/g) ?? []
    fontBlocks.forEach((font, index) => {
      if (/<strike\b/i.test(font)) strikeFontIds.add(index)
    })
  }

  const strikeStyleIndices = new Set<number>()
  const xfsMatch = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)
  if (!xfsMatch) return strikeStyleIndices

  const xfBlocks = xfsMatch[1].match(/<xf\b[\s\S]*?(?:\/>|<\/xf>)/g) ?? []
  xfBlocks.forEach((xf, index) => {
    const fontId = xf.match(/\bfontId="(\d+)"/)?.[1]
    if (fontId && strikeFontIds.has(Number(fontId))) {
      strikeStyleIndices.add(index)
    }
  })

  return strikeStyleIndices
}

function parseStruckRowIndicesFromSheetXml(sheetXml: string, strikeStyleIndices: Set<number>) {
  const struckRows = new Set<number>()
  const cellBlocks = sheetXml.match(/<c\b[^>]*(?:\/>|>[\s\S]*?<\/c>)/g) ?? []

  for (const cell of cellBlocks) {
    const ref = cell.match(/\br="([A-Z]+)(\d+)"/i)?.[2]
    if (!ref) continue
    const rowIndex = Number(ref) - 1

    if (/<rPr\b[^>]*>[\s\S]*?<strike\b/i.test(cell)) {
      struckRows.add(rowIndex)
      continue
    }

    const styleId = cell.match(/\bs="(\d+)"/)?.[1]
    if (styleId && strikeStyleIndices.has(Number(styleId))) {
      struckRows.add(rowIndex)
    }
  }

  return struckRows
}

export function detectStrikethroughRowsFromXlsxBuffer(buffer: ArrayBuffer, sheetIndex: number, XLSX: CfbModule) {
  try {
    const cfb = XLSX.CFB.read(new Uint8Array(buffer), { type: 'array' })
    const stylesXml = readCfbEntry(cfb, XLSX, '/xl/styles.xml')
    if (!stylesXml) return new Set<number>()

    const strikeStyleIndices = parseStrikeStyleIndices(stylesXml)

    const sheetXml = readCfbEntry(cfb, XLSX, `/xl/worksheets/sheet${sheetIndex + 1}.xml`)
    if (!sheetXml) return new Set<number>()

    return parseStruckRowIndicesFromSheetXml(sheetXml, strikeStyleIndices)
  } catch {
    return new Set<number>()
  }
}

function rowLooksStruckInHtml(rowHtml: string) {
  return (
    /text-decoration\s*:\s*[^;"]*line-through/i.test(rowHtml) ||
    /mso-text-underline\s*:\s*[^;"]*line-through/i.test(rowHtml) ||
    /<(?:s|strike)\b/i.test(rowHtml)
  )
}

export function detectStrikethroughRowsFromHtml(text: string) {
  const struckRows = new Set<number>()
  const tableMatch = text.match(/<table\b[\s\S]*?<\/table>/i)
  if (!tableMatch) return struckRows

  const rowBlocks = tableMatch[0].match(/<tr\b[\s\S]*?<\/tr>/gi) ?? []
  rowBlocks.forEach((rowHtml, index) => {
    if (rowLooksStruckInHtml(rowHtml)) struckRows.add(index)
  })

  return struckRows
}

export function mapRawSheetStrikeRowsToFilteredRows(
  rawRows: unknown[][],
  struckRawRows: Set<number>,
  toCellString: (value: unknown) => string,
) {
  const struckFilteredRows = new Set<number>()
  let filteredIndex = 0

  for (let rawIndex = 0; rawIndex < rawRows.length; rawIndex += 1) {
    const row = rawRows[rawIndex]!.map(toCellString)
    if (!row.some(Boolean)) continue
    if (struckRawRows.has(rawIndex)) {
      struckFilteredRows.add(filteredIndex)
    }
    filteredIndex += 1
  }

  return struckFilteredRows
}
