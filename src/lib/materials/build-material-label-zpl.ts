import type { MaterialLabelPrintItem } from '@/lib/materials/print-material-labels'

/** ZM400 등 203dpi 기준. 설계 기준 라벨 40×30mm */
const DEFAULT_DPI = 203
const BASE_WIDTH_MM = 40
const BASE_HEIGHT_MM = 30

function mmToDots(mm: number, dpi = DEFAULT_DPI) {
  return Math.round((mm * dpi) / 25.4)
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
 * 자재 라벨 1장 ZPL.
 * 용지 mm에 맞춰 글자·바코드 크기를 비율 스케일한다.
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
  const marginX = clamp(Math.round(width * 0.04), 4, 24)

  const nameH = clamp(Math.round(18 * scale), 10, 42)
  const specH = clamp(Math.round(14 * scale), 8, 32)
  const idH = clamp(Math.round(16 * scale), 10, 36)
  const gap = clamp(Math.round(4 * scale), 2, 10)
  const barcodeH = clamp(Math.round(height * 0.32), 18, Math.round(height * 0.55))
  const moduleW = clamp(Number((1.2 * scale).toFixed(1)), 0.8, 3)

  const showText = heightMm >= 14
  const nameMax = clamp(Math.round(18 + widthMm * 0.2), 12, 36)
  const specMax = clamp(Math.round(20 + widthMm * 0.2), 14, 40)
  const name = showText ? sanitizeZplField(truncateText(item.materialName || '', nameMax)) : ''
  const spec = showText ? sanitizeZplField(truncateText(item.specification || '', specMax)) : ''
  const copies = Math.max(1, Math.floor(Number(item.copies) || 1))

  const lines: string[] = []
  for (let index = 0; index < copies; index += 1) {
    const blocks = [
      '^XA',
      '^CI28',
      `^PW${width}`,
      `^LL${height}`,
      '^LH0,0',
      '^LS0',
      // 프린터 저장된 라벨 길이와 무관하게 이번 포맷 길이를 사용
      '^JMA',
    ]

    let y = clamp(Math.round(height * 0.04), 4, 16)

    if (name) {
      blocks.push(`^FO${marginX},${y}^A0N,${nameH},${nameH}^FD${name}^FS`)
      y += nameH + gap
    }
    if (spec) {
      blocks.push(`^FO${marginX},${y}^A0N,${specH},${specH}^FD${spec}^FS`)
      y += specH + gap
    }

    // 남은 세로에 맞게 바코드 배치
    const remaining = height - y - idH - gap * 2
    const barH = clamp(Math.min(barcodeH, remaining), 14, remaining)
    blocks.push(
      `^FO${marginX},${y}^BY${moduleW},2,${barH}^BCN,${barH},N,N,N^FD${id}^FS`,
    )
    y += barH + gap
    blocks.push(`^FO${marginX},${y}^A0N,${idH},${idH}^FD${id}^FS`)

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
