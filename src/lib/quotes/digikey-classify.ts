import type { DigiKeyProductSummary } from '@/lib/quotes/digikey-client'
import type { PickPlaceDigiKeyClassification } from '@/lib/quotes/digikey-types'
import type { PickPlaceComponentCategory } from '@/lib/quotes/parse-altium-pick-place'

function parseBgaBallCount(text: string) {
  const matrix = text.match(/(\d+)\s*[xX×]\s*(\d+)/)
  if (matrix) return Number(matrix[1]) * Number(matrix[2])
  const balls = text.match(/(\d+)\s*ball/i)
  if (balls) return Number(balls[1])
  return undefined
}

function passiveLabel(product: DigiKeyProductSummary) {
  const category = product.category.toUpperCase()
  if (/RESISTOR/.test(category)) return '저항'
  if (/CAPACITOR/.test(category)) return '커패시터'
  if (/INDUCTOR/.test(category)) return '인덕터'
  const size = product.packageName.match(/\b(0201|0402|0603|0805|1206|1210)\b/i)?.[1]
  if (size) return `${size} 패시브`
  return '패시브'
}

function oddLabel(product: DigiKeyProductSummary, text: string) {
  if (/LED/.test(text)) return 'LED'
  if (/CRYSTAL|OSCILLATOR/.test(text)) return '크리스탈'
  if (/SWITCH/.test(text)) return '스위치'
  if (/MOSFET|TRANSISTOR/.test(text)) return '트랜지스터'
  if (/DIODE/.test(text)) return '다이오드'
  return '이형'
}

function icLabel(product: DigiKeyProductSummary, pinCount?: number) {
  const pkg = product.packageName.trim()
  if (pkg && pinCount) return `IC · ${pkg} · ${pinCount}핀`
  if (pkg) return `IC · ${pkg}`
  if (pinCount) return `IC · ${pinCount}핀`
  return 'IC'
}

export function classifyPickPlaceFromDigiKeyProduct(input: {
  designator: string
  mpn: string
  product: DigiKeyProductSummary
}): PickPlaceDigiKeyClassification {
  const { designator, mpn, product } = input
  const text = `${product.category} ${product.description} ${product.packageName} ${product.mountingType}`.toUpperCase()

  let category: PickPlaceComponentCategory = 'chip'
  let icPinCount: number | undefined
  let bgaBallCount: number | undefined
  let reason = passiveLabel(product)

  if (/BGA|CSP|LGA/.test(text) || /BGA|CSP|LGA/i.test(product.packageName)) {
    category = 'bga'
    bgaBallCount = parseBgaBallCount(`${product.packageName} ${product.description}`) ?? product.pinCount
    reason = bgaBallCount ? `BGA ${bgaBallCount}볼` : product.packageName.trim() || 'BGA'
  } else if (
    /CONNECTOR|HEADER|SOCKET|USB|RJ45|FFC|FPC|TERMINAL/.test(text) ||
    /CONNECTOR|HEADER|SOCKET/i.test(product.category)
  ) {
    category = 'special'
    reason = '커넥터'
  } else if (
    /CRYSTAL|OSCILLATOR|SWITCH|LED|TRANSISTOR|MOSFET|DIODE(?!S)/.test(text) ||
    /CRYSTAL|OSCILLATOR|SWITCH/i.test(product.category)
  ) {
    category = 'odd'
    reason = oddLabel(product, text)
  } else if (
    /RESISTOR|CAPACITOR|INDUCTOR|FERRITE|BEAD|FILTER/.test(text) ||
    /RESISTOR|CAPACITOR|INDUCTOR/i.test(product.category)
  ) {
    category = 'chip'
    reason = passiveLabel(product)
  } else if (
    /INTEGRATED CIRCUIT|MICROCONTROLLER|FPGA|PROCESSOR|PMIC|REGULATOR|OP AMP|LOGIC|MEMORY/.test(text) ||
    /INTEGRATED CIRCUIT|IC /i.test(product.category) ||
    product.pinCount
  ) {
    category = 'ic'
    icPinCount = product.pinCount
    reason = icLabel(product, icPinCount)
  } else if (/THROUGH HOLE|TH\b|AXIAL|RADIAL|DIP/.test(text) || /THROUGH HOLE/i.test(product.mountingType)) {
    category = 'special'
    reason = '수삽'
  }

  return {
    designator,
    mpn,
    category,
    icPinCount,
    bgaBallCount,
    reason,
    digiKeyPartNumber: product.digiKeyPartNumber,
  }
}
