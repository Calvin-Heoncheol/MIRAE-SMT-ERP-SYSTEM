import type { MaterialLabelPrintItem } from '@/lib/materials/print-material-labels'

/** ZM400 등 203dpi 기준. 설계 기준 라벨 40×30mm */
const DEFAULT_DPI = 203
const BASE_WIDTH_MM = 40
const BASE_HEIGHT_MM = 30

/** 바코드가 라벨 폭에서 차지할 목표 비율 */
const BARCODE_WIDTH_RATIO = 0.68
/** Code 128 quiet zone (모듈 수, 한쪽) — 실제 출력·스캔 여유 */
const QUIET_MODULES_EACH = 10
/** 오른쪽 잘림 보정: 전체를 약간 왼쪽으로 */
const CENTER_LEFT_NUDGE_DOTS = 8

function mmToDots(mm: number, dpi = DEFAULT_DPI) {
  return Math.max(1, Math.round((mm * dpi) / 25.4))
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

/** ZPL 필드 데이터에서 제어문자 제거 */
function sanitizeZplField(value: string) {
  return String(value || '')
    .replace(/[\^~]/g, ' ')
    .replace(/[\r\n\t]/g, ' ')
    .trim()
}

function truncateText(value: string, maxLength: number) {
  const trimmed = value.trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, maxLength - 1)}.`
}

/**
 * Code 128 심볼 모듈 수 (quiet zone 제외).
 * quiet·좌우 여백은 resolveModuleWidth 에서 확보한다.
 */
function estimateCode128SymbolModules(dataLength: number) {
  const n = Math.max(1, dataLength)
  // start + data + check + stop
  return 11 + n * 11 + 11 + 13
}

/**
 * 라벨 폭의 ~68%를 목표로 모듈 폭 결정.
 * 정수(1|2)만 쓰면 여백이 극단으로만 가서, 0.5 단위로 맞춘다.
 * quiet zone까지 포함한 폭이 라벨 안에 들어가게 계산한다.
 */
function resolveModuleWidth(labelWidthDots: number, dataLength: number) {
  const symbolModules = estimateCode128SymbolModules(dataLength)
  const printModules = symbolModules + QUIET_MODULES_EACH * 2
  const minSide = clamp(Math.round(labelWidthDots * 0.03), 8, 14)
  const maxPrint = Math.max(20, labelWidthDots - minSide * 2)
  const targetPrint = Math.min(maxPrint, Math.round(labelWidthDots * BARCODE_WIDTH_RATIO))

  let best = 1
  let bestDiff = Number.POSITIVE_INFINITY
  for (let step = 2; step <= 8; step += 1) {
    const w = step / 2
    const pw = printModules * w
    if (pw > maxPrint) continue
    const diff = Math.abs(pw - targetPrint)
    if (diff < bestDiff) {
      best = w
      bestDiff = diff
    }
  }
  return best
}

function formatByModule(moduleW: number) {
  return Number.isInteger(moduleW) ? String(moduleW) : moduleW.toFixed(1)
}

/** 열전사에서 선명한 글자 크기(도트)로 스냅 */
function snapFontDots(value: number) {
  const sizes = [20, 22, 24, 28, 32, 36, 40]
  let best = sizes[0]
  for (const size of sizes) {
    if (Math.abs(size - value) < Math.abs(best - value)) best = size
  }
  return best
}

/** 가로 중앙 정렬 텍스트 (^FB C) */
function centeredTextLine(y: number, fontH: number, width: number, text: string) {
  const fieldWidth = Math.max(20, width - 4)
  return `^FO0,${y}^A0N,${fontH},${fontH}^FB${fieldWidth},1,0,C^FD${text}^FS`
}

/**
 * 자재 라벨 1장 ZPL.
 * 표시: 품목명 · 규격, 패키지 (가운데) + 바코드 + 코드
 */
export function buildMaterialLabelZpl(
  item: MaterialLabelPrintItem,
  options?: { widthMm?: number; heightMm?: number; dpi?: number },
): string {
  const id = sanitizeZplField(item.id)
  if (!id) return ''

  const dpi = options?.dpi ?? DEFAULT_DPI
  const widthMm = options?.widthMm ?? BASE_WIDTH_MM
  const heightMm = options?.heightMm ?? BASE_HEIGHT_MM
  const width = mmToDots(widthMm, dpi)
  const height = mmToDots(heightMm, dpi)

  const scale = clamp(Math.min(widthMm / BASE_WIDTH_MM, heightMm / BASE_HEIGHT_MM), 0.35, 2.2)
  const marginTop = clamp(Math.round(height * 0.08), 12, 24)
  const marginBottom = clamp(Math.round(height * 0.06), 10, 20)
  const printableHeight = Math.max(24, height - marginTop - marginBottom)

  const showText = heightMm >= 14
  const nameMax = clamp(Math.round(18 + widthMm * 0.2), 12, 36)
  const specMax = clamp(Math.round(24 + widthMm * 0.25), 18, 48)
  const name = showText ? sanitizeZplField(truncateText(item.materialName || '', nameMax)) : ''
  const specRaw = sanitizeZplField(item.specification || '')
  const pkgRaw = sanitizeZplField(item.package || '')
  const specLineRaw = [specRaw, pkgRaw].filter(Boolean).join(', ')
  const spec = showText ? truncateText(specLineRaw, specMax) : ''
  const hasHeader = Boolean(name || spec)

  const nameH = name ? clamp(Math.round(17 * scale), 14, 32) : 0
  const specH = spec ? clamp(Math.round(15 * scale), 13, 28) : 0
  const idH = snapFontDots(clamp(Math.round((hasHeader ? 22 : 28) * scale), 20, 38))
  const idW = Math.max(18, Math.round(idH * 0.88))
  const gap = clamp(Math.round(2.5 * scale), 2, 6)

  const moduleW = resolveModuleWidth(width, id.length)
  const symbolModules = estimateCode128SymbolModules(id.length)
  const printWidth = Math.ceil((symbolModules + QUIET_MODULES_EACH * 2) * moduleW)
  const symbolWidth = Math.ceil(symbolModules * moduleW)
  const quietDots = Math.ceil(QUIET_MODULES_EACH * moduleW)
  const barcodeX = Math.max(
    2,
    Math.round((width - printWidth) / 2) + quietDots - CENTER_LEFT_NUDGE_DOTS,
  )
  const barcodeXClamped = Math.min(barcodeX, Math.max(2, width - symbolWidth - 2))

  const headerBlock = (name ? nameH + gap : 0) + (spec ? specH + gap : 0)
  const footerBlock = gap + idH
  const barcodeBudget = Math.max(16, printableHeight - headerBlock - footerBlock)
  const barcodeRatio = hasHeader ? 0.2 : 0.28
  const barH = clamp(Math.round(height * barcodeRatio), 16, barcodeBudget)
  const contentH = headerBlock + barH + footerBlock
  const contentTop =
    marginTop + Math.max(0, Math.round((printableHeight - contentH) / 2))

  const copies = Math.max(1, Math.floor(Number(item.copies) || 1))
  const byModule = formatByModule(moduleW)

  const lines: string[] = []
  for (let index = 0; index < copies; index += 1) {
    const blocks = [
      '^XA',
      '^CI28',
      '^PR1',
      '^MD25',
      `^PW${width}`,
      `^LL${height}`,
      '^LH0,0',
      '^LS0',
      '^LT0',
      '^JMA',
    ]

    let y = contentTop

    if (name) {
      blocks.push(centeredTextLine(y, nameH, width, name))
      y += nameH + gap
    }
    if (spec) {
      blocks.push(centeredTextLine(y, specH, width, spec))
      y += specH + gap
    }

    blocks.push(
      `^FO${barcodeXClamped},${y}^BY${byModule},2,${barH}^BCN,${barH},N,N,N^FD${id}^FS`,
    )
    y += barH + gap

    const idApproxWidth = Math.round(id.length * idW * 0.62)
    const idX = Math.max(
      2,
      Math.round((width - idApproxWidth) / 2) - CENTER_LEFT_NUDGE_DOTS,
    )
    const idField = `^A0N,${idH},${idW}^FD${id}^FS`
    blocks.push(`^FO${idX},${y}${idField}`)
    blocks.push(`^FO${idX},${y}${idField}`)

    blocks.push('^XZ')
    lines.push(blocks.join('\n'))
  }

  return lines.join('\n')
}

export function buildMaterialLabelsZpl(
  items: MaterialLabelPrintItem[],
  options?: { widthMm?: number; heightMm?: number; dpi?: number },
) {
  return items
    .map((item) => buildMaterialLabelZpl(item, options))
    .filter(Boolean)
    .join('\n')
}
