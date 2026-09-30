import { encodeCode128Modules } from './code128'
import { VIUCOMM_P141A_BOX_BASE_B64 } from './templates/viucomm-p141a-box-base'

/** 원본 CODESOFT 출력 기준 (203dpi) */
const LABEL_WIDTH = 256
const LABEL_HEIGHT = 160
const PRINT_WIDTH = 240
const ROW_BYTES = LABEL_WIDTH / 8
const BASE_GRAPHIC_NAME = 'R:VIUP141A.GRF'

/** 라벨마다 바뀌는 영역 — S/N 번호 + 바코드 */
const VAR_X = 16
const VAR_Y = 113
const VAR_WIDTH = 184
const VAR_HEIGHT = 33

/** S/N 번호 글자 위치 (라벨 좌표) — 원본 "WAG268830726" 잉크 기준 */
const SERIAL_LEFT = 43
const SERIAL_RIGHT_LIMIT = 160
const SERIAL_DIGIT_TOP = 115
/** 원본 비트맵과 도트 비교로 맞춘 값 (Arial, 차이 최소) */
const SERIAL_DIGIT_HEIGHT = 8.25
const SERIAL_REFERENCE = 'WAG268830726'
const SERIAL_REFERENCE_INK_WIDTH = 105
const SERIAL_OFFSET_X = -0.5

const BARCODE_X = 16
const BARCODE_Y = 130
const BARCODE_HEIGHT = 16

const SUPERSAMPLE = 8
const INK_THRESHOLD = 0.6
const SERIAL_FONT = 'Arial, Helvetica, sans-serif'

export const VIUCOMM_P141A_BOX_LABEL = {
  id: 'viucomm-p141a-box',
  label: 'VIUCOMM P141A-B01P-07 박스 하단 (지상단)',
  widthMm: 30,
  heightMm: 20,
  dpi: 203,
} as const

type Bitmap = { width: number; height: number; rowBytes: number; bits: Uint8Array }

function createBitmap(width: number, height: number): Bitmap {
  const rowBytes = Math.ceil(width / 8)
  return { width, height, rowBytes, bits: new Uint8Array(rowBytes * height) }
}

function setDot(bitmap: Bitmap, x: number, y: number) {
  if (x < 0 || y < 0 || x >= bitmap.width || y >= bitmap.height) return
  bitmap.bits[y * bitmap.rowBytes + (x >> 3)] |= 1 << (7 - (x & 7))
}

function getDot(bitmap: Bitmap, x: number, y: number) {
  return (bitmap.bits[y * bitmap.rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1
}

function toHex(bytes: Uint8Array) {
  let out = ''
  for (const byte of bytes) out += byte.toString(16).padStart(2, '0').toUpperCase()
  return out
}

let baseBitmapCache: Bitmap | null = null

function baseBitmap(): Bitmap {
  if (baseBitmapCache) return baseBitmapCache
  const binary = atob(VIUCOMM_P141A_BOX_BASE_B64)
  const bits = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bits[i] = binary.charCodeAt(i)
  baseBitmapCache = { width: LABEL_WIDTH, height: LABEL_HEIGHT, rowBytes: ROW_BYTES, bits }
  return baseBitmapCache
}

type SerialMetrics = { fontPx: number; scaleX: number; ascent: number }
let serialMetricsCache: SerialMetrics | null = null

function measureSerialMetrics(ctx: CanvasRenderingContext2D): SerialMetrics {
  if (serialMetricsCache) return serialMetricsCache
  const targetHeight = SERIAL_DIGIT_HEIGHT * SUPERSAMPLE
  let fontPx = targetHeight / 0.716
  ctx.font = `${fontPx}px ${SERIAL_FONT}`
  const digit = ctx.measureText('0')
  const digitHeight = digit.actualBoundingBoxAscent + digit.actualBoundingBoxDescent
  if (digitHeight > 0) fontPx *= targetHeight / digitHeight
  ctx.font = `${fontPx}px ${SERIAL_FONT}`
  const ref = ctx.measureText(SERIAL_REFERENCE)
  const refInk = ref.actualBoundingBoxLeft + ref.actualBoundingBoxRight
  const scaleX = refInk > 0 ? (SERIAL_REFERENCE_INK_WIDTH * SUPERSAMPLE) / refInk : 1
  const ascent = ctx.measureText('0').actualBoundingBoxAscent
  serialMetricsCache = { fontPx, scaleX, ascent }
  return serialMetricsCache
}

/** S/N 번호를 원본과 같은 크기·폭으로 1bit 렌더 (브라우저 전용) */
function drawSerial(target: Bitmap, serial: string, offsetX: number, offsetY: number) {
  const areaWidth = SERIAL_RIGHT_LIMIT - SERIAL_LEFT + 1
  const areaHeight = Math.ceil(SERIAL_DIGIT_HEIGHT) + 4
  const canvas = document.createElement('canvas')
  canvas.width = areaWidth * SUPERSAMPLE
  canvas.height = areaHeight * SUPERSAMPLE
  const ctx = canvas.getContext('2d')
  if (!ctx) return

  const metrics = measureSerialMetrics(ctx)
  ctx.font = `${metrics.fontPx}px ${SERIAL_FONT}`
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#000'
  const inkLeft = ctx.measureText(serial).actualBoundingBoxLeft
  ctx.setTransform(metrics.scaleX, 0, 0, 1, 0, 0)
  ctx.fillText(serial, inkLeft + (SERIAL_OFFSET_X * SUPERSAMPLE) / metrics.scaleX, metrics.ascent)

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const block = SUPERSAMPLE * SUPERSAMPLE
  for (let y = 0; y < areaHeight; y += 1) {
    for (let x = 0; x < areaWidth; x += 1) {
      let alpha = 0
      for (let dy = 0; dy < SUPERSAMPLE; dy += 1) {
        const row = (y * SUPERSAMPLE + dy) * canvas.width
        for (let dx = 0; dx < SUPERSAMPLE; dx += 1) {
          alpha += data[(row + x * SUPERSAMPLE + dx) * 4 + 3]
        }
      }
      if (alpha / (block * 255) >= INK_THRESHOLD) setDot(target, offsetX + x, offsetY + y)
    }
  }
}

function drawBarcode(
  target: Bitmap,
  serial: string,
  offsetX: number,
  offsetY: number,
  moduleWidth = 1,
  height = BARCODE_HEIGHT,
) {
  const modules = encodeCode128Modules(serial)
  if (!modules) return
  modules.forEach((black, index) => {
    if (!black) return
    for (let dx = 0; dx < moduleWidth; dx += 1) {
      for (let y = 0; y < height; y += 1) setDot(target, offsetX + index * moduleWidth + dx, offsetY + y)
    }
  })
}

function buildVariableRegion(serial: string): Bitmap {
  const region = createBitmap(VAR_WIDTH, VAR_HEIGHT)
  drawSerial(region, serial, SERIAL_LEFT - VAR_X, SERIAL_DIGIT_TOP - VAR_Y)
  drawBarcode(region, serial, BARCODE_X - VAR_X, BARCODE_Y - VAR_Y)
  return region
}

/** 최근접 보간 확대/축소 (203dpi 원본 → 다른 DPI) */
function scaleBitmap(source: Bitmap, scale: number, width?: number, height?: number): Bitmap {
  const out = createBitmap(width ?? Math.round(source.width * scale), height ?? Math.round(source.height * scale))
  for (let y = 0; y < out.height; y += 1) {
    const sy = Math.floor(y / scale)
    if (sy >= source.height) break
    for (let x = 0; x < out.width; x += 1) {
      const sx = Math.floor(x / scale)
      if (sx >= source.width) break
      if (getDot(source, sx, sy)) setDot(out, x, y)
    }
  }
  return out
}

/** 다른 DPI용 가변 영역 — S/N 글자는 확대, 바코드는 정수 모듈로 다시 그림 (스캔 품질 유지) */
function buildScaledVariableRegion(serial: string, scale: number): Bitmap {
  const serialOnly = createBitmap(VAR_WIDTH, VAR_HEIGHT)
  drawSerial(serialOnly, serial, SERIAL_LEFT - VAR_X, SERIAL_DIGIT_TOP - VAR_Y)

  const moduleWidth = Math.max(1, Math.round(scale))
  const barcodeLeft = Math.round((BARCODE_X - VAR_X) * scale)
  const barcodeTop = Math.round((BARCODE_Y - VAR_Y) * scale)
  const barcodeHeight = Math.round(BARCODE_HEIGHT * scale)
  const moduleCount = encodeCode128Modules(serial)?.length ?? 0
  const width = Math.max(Math.round(VAR_WIDTH * scale), barcodeLeft + moduleCount * moduleWidth)
  const height = Math.max(Math.round(VAR_HEIGHT * scale), barcodeTop + barcodeHeight)

  const region = scaleBitmap(serialOnly, scale, Math.ceil(width / 8) * 8, height)
  drawBarcode(region, serial, barcodeLeft, barcodeTop, moduleWidth, barcodeHeight)
  return region
}

export type ViucommPrintLayout = {
  /** 실제 라벨 용지 크기 */
  widthMm: number
  heightMm: number
  dpi: number
  /** 위치 보정 (+ 오른쪽·아래) */
  offsetXMm?: number
  offsetYMm?: number
  /** 0~30 */
  darkness?: number
  /** 2~6 ips */
  printSpeed?: number
}

const DEFAULT_LAYOUT: ViucommPrintLayout = { widthMm: 30, heightMm: 20, dpi: 203 }

function mmToDots(mm: number, dpi: number) {
  return Math.round((mm * dpi) / 25.4)
}

export function validateViucommSerial(serial: string): string | null {
  const value = serial.trim()
  if (!value) return 'S/N을 입력하세요.'
  if (!encodeCode128Modules(value)) return 'S/N에는 영문·숫자·기호(ASCII)만 사용할 수 있습니다.'
  if (value.length > 14) return 'S/N이 너무 깁니다. (최대 14자 — 라벨 폭 초과)'
  return null
}

/** ZPL — 배경은 프린터 메모리에 1회 저장, 라벨마다 S/N·바코드 영역만 전송 */
export function buildViucommP141aBoxLabelsZpl(
  serials: string[],
  copiesPerSerial = 1,
  layout: ViucommPrintLayout = DEFAULT_LAYOUT,
) {
  const list = serials.map((value) => value.trim()).filter(Boolean)
  if (!list.length) return ''
  const copies = Math.max(1, Math.floor(copiesPerSerial) || 1)

  const dpi = layout.dpi > 0 ? layout.dpi : VIUCOMM_P141A_BOX_LABEL.dpi
  const scale = dpi / VIUCOMM_P141A_BOX_LABEL.dpi
  const exact = Math.abs(scale - 1) < 0.001
  const base = exact ? baseBitmap() : scaleBitmap(baseBitmap(), scale)
  const graphicName = exact ? BASE_GRAPHIC_NAME : `R:VIUB${dpi}.GRF`

  const designWidth = exact ? PRINT_WIDTH : Math.round(PRINT_WIDTH * scale)
  const designHeight = base.height
  const labelWidth = Math.max(designWidth, mmToDots(layout.widthMm, dpi))
  const labelHeight = Math.max(designHeight, mmToDots(layout.heightMm, dpi))
  const originX = Math.round((labelWidth - designWidth) / 2 + mmToDots(layout.offsetXMm ?? 0, dpi))
  const originY = Math.round((labelHeight - designHeight) / 2)
  // 상하 보정은 ^LT로 인쇄 영역 전체를 옮김 — ^LH로 내리면 ^LL 경계에서 아래가 잘림
  const topShift = Math.min(120, Math.max(-120, mmToDots(layout.offsetYMm ?? 0, dpi)))
  // 왼쪽 이동은 ^LH가 음수를 못 받으므로 ^LS(라벨 시프트)로 처리
  const homeX = Math.max(0, originX)
  const shiftX = originX < 0 ? -originX : 0
  // 오른쪽으로 옮긴 만큼 인쇄 폭을 늘려 오른쪽 끝이 잘리지 않게
  const printWidth = labelWidth + homeX

  const darkness = Math.min(30, Math.max(0, Math.round(layout.darkness ?? 20)))
  const speed = Math.min(6, Math.max(2, Math.round(layout.printSpeed ?? 3)))

  const parts = [
    `^XA^MNW^MTT^PON^PMN^LRN^PR${speed},${speed}~SD${String(darkness).padStart(2, '0')}^CI27^XZ`,
    `~DG${graphicName},${base.bits.length},${base.rowBytes},${toHex(base.bits)}`,
  ]

  for (const serial of list) {
    const region = exact ? buildVariableRegion(serial) : buildScaledVariableRegion(serial, scale)
    const varX = exact ? VAR_X : Math.round(VAR_X * scale)
    const varY = exact ? VAR_Y : Math.round(VAR_Y * scale)
    parts.push(
      [
        '^XA^MMT',
        `^PW${printWidth}^LL${labelHeight}^LT${topShift}^LS${shiftX}^LH${homeX},${originY}`,
        `^FO0,0^XG${graphicName},1,1^FS`,
        `^FO${varX},${varY}^GFA,${region.bits.length},${region.bits.length},${region.rowBytes},${toHex(region.bits)}^FS`,
        `^PQ${copies},0,1,Y^XZ`,
      ].join('\n'),
    )
  }

  // ^LT·^LS는 프린터에 계속 남으므로 다른 라벨 출력에 영향 없게 원복
  parts.push('^XA^LT0^LS0^XZ')

  return parts.join('\n')
}

/** 인쇄 결과와 동일한 미리보기 PNG (data URL, 240×160) */
export function renderViucommP141aBoxLabelDataUrl(serial: string) {
  const base = baseBitmap()
  const canvas = document.createElement('canvas')
  canvas.width = PRINT_WIDTH
  canvas.height = LABEL_HEIGHT
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const region = serial.trim() ? buildVariableRegion(serial.trim()) : null
  const image = ctx.createImageData(PRINT_WIDTH, LABEL_HEIGHT)
  for (let y = 0; y < LABEL_HEIGHT; y += 1) {
    for (let x = 0; x < PRINT_WIDTH; x += 1) {
      let black = getDot(base, x, y) === 1
      if (!black && region) {
        const rx = x - VAR_X
        const ry = y - VAR_Y
        if (rx >= 0 && ry >= 0 && rx < VAR_WIDTH && ry < VAR_HEIGHT) black = getDot(region, rx, ry) === 1
      }
      const offset = (y * PRINT_WIDTH + x) * 4
      const value = black ? 0 : 255
      image.data[offset] = value
      image.data[offset + 1] = value
      image.data[offset + 2] = value
      image.data[offset + 3] = 255
    }
  }
  ctx.putImageData(image, 0, 0)
  return canvas.toDataURL('image/png')
}
