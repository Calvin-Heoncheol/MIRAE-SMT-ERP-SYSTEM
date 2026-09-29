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
const VAR_ROW_BYTES = VAR_WIDTH / 8

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

function drawBarcode(target: Bitmap, serial: string, offsetX: number, offsetY: number) {
  const modules = encodeCode128Modules(serial)
  if (!modules) return
  modules.forEach((black, index) => {
    if (!black) return
    for (let y = 0; y < BARCODE_HEIGHT; y += 1) setDot(target, offsetX + index, offsetY + y)
  })
}

function buildVariableRegion(serial: string): Bitmap {
  const region = createBitmap(VAR_WIDTH, VAR_HEIGHT)
  drawSerial(region, serial, SERIAL_LEFT - VAR_X, SERIAL_DIGIT_TOP - VAR_Y)
  drawBarcode(region, serial, BARCODE_X - VAR_X, BARCODE_Y - VAR_Y)
  return region
}

export function validateViucommSerial(serial: string): string | null {
  const value = serial.trim()
  if (!value) return 'S/N을 입력하세요.'
  if (!encodeCode128Modules(value)) return 'S/N에는 영문·숫자·기호(ASCII)만 사용할 수 있습니다.'
  if (value.length > 14) return 'S/N이 너무 깁니다. (최대 14자 — 라벨 폭 초과)'
  return null
}

/** ZPL — 배경은 프린터 메모리에 1회 저장, 라벨마다 S/N·바코드 영역만 전송 */
export function buildViucommP141aBoxLabelsZpl(serials: string[], copiesPerSerial = 1) {
  const list = serials.map((value) => value.trim()).filter(Boolean)
  if (!list.length) return ''
  const copies = Math.max(1, Math.floor(copiesPerSerial) || 1)
  const base = baseBitmap()

  const parts = [
    '^XA~TA000~JSN^LT0^MNW^MTT^PON^PMN^LH0,0^JMA^PR6,6~SD15^LRN^CI27^PA0,1,1,0^XZ',
    `~DG${BASE_GRAPHIC_NAME},${base.bits.length},${ROW_BYTES},${toHex(base.bits)}`,
  ]

  for (const serial of list) {
    const region = buildVariableRegion(serial)
    parts.push(
      [
        '^XA^MMT',
        `^PW${PRINT_WIDTH}^LL${LABEL_HEIGHT}^LS0`,
        `^FO0,0^XG${BASE_GRAPHIC_NAME},1,1^FS`,
        `^FO${VAR_X},${VAR_Y}^GFA,${region.bits.length},${region.bits.length},${VAR_ROW_BYTES},${toHex(region.bits)}^FS`,
        `^PQ${copies},0,1,Y^XZ`,
      ].join('\n'),
    )
  }

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
