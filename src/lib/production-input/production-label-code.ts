/**
 * 생산등록용 바코드 라벨 코드 (순수 헬퍼).
 * 발급·스캔 이력은 DB(`production_unit_labels`)에 저장.
 */

export type ProductionLabelPayload =
  | {
      kind: 'smt_plan'
      planId: string
    }
  | {
      kind: 'post_plan'
      planId: string
    }
  | {
      kind: 'smt_order'
      orderLineId: string
      pcbSide: 'SINGLE' | 'TOP' | 'BOT'
      lineNo: number | null
    }
  | {
      kind: 'post_order'
      assemblyGroupId: string
      team: string
    }

export type ParsedProductionLabel = ProductionLabelPayload & {
  /** 전체 바코드 (시리얼 포함) */
  fullCode: string
  /** 시리얼 없는 건 식별 코드 */
  baseCode: string
  /** 1부터. 구버전(시리얼 없음)은 null */
  sequence: number | null
}

const PREFIX = {
  smt_plan: 'MRP1P',
  post_plan: 'MRP2P',
  smt_order: 'MRP1',
  post_order: 'MRP2',
} as const

function cleanPart(value: string) {
  return String(value || '')
    .trim()
    .replace(/\|/g, '')
}

function seqWidthForCount(count: number, startSeq: number) {
  const end = startSeq + Math.max(0, count) - 1
  return Math.max(4, String(Math.max(end, 1)).length)
}

function formatSequence(seq: number, width: number) {
  const raw = String(Math.max(1, Math.floor(seq)))
  return raw.length >= width ? raw : raw.padStart(width, '0')
}

/** 시리얼 없는 건 식별 코드 */
export function buildProductionLabelBase(payload: ProductionLabelPayload): string {
  if (payload.kind === 'smt_plan') {
    return `${PREFIX.smt_plan}|${cleanPart(payload.planId)}`
  }
  if (payload.kind === 'post_plan') {
    return `${PREFIX.post_plan}|${cleanPart(payload.planId)}`
  }
  if (payload.kind === 'smt_order') {
    const line = payload.lineNo != null && payload.lineNo > 0 ? String(payload.lineNo) : '0'
    return `${PREFIX.smt_order}|${cleanPart(payload.orderLineId)}|${payload.pcbSide}|${line}`
  }
  return `${PREFIX.post_order}|${cleanPart(payload.assemblyGroupId)}|${cleanPart(payload.team)}`
}

/** @deprecated 호환 — base 코드 */
export function buildProductionLabelCode(payload: ProductionLabelPayload): string {
  return buildProductionLabelBase(payload)
}

export function buildProductionLabelCodes(
  payload: ProductionLabelPayload,
  count: number,
  startSeq = 1,
): string[] {
  const total = Math.max(0, Math.floor(Number(count) || 0))
  if (total < 1) return []
  const base = buildProductionLabelBase(payload)
  const start = Math.max(1, Math.floor(Number(startSeq) || 1))
  const width = seqWidthForCount(total, start)
  const codes: string[] = []
  for (let index = 0; index < total; index += 1) {
    codes.push(`${base}|${formatSequence(start + index, width)}`)
  }
  return codes
}

/**
 * 직접 입력한 시작 바코드부터 매수만큼 연속 생성.
 * 예: M67530001 × 3 → M67530001, M67530002, M67530003
 * 끝자리 숫자가 없으면 1장만 그대로 출력.
 */
export function buildSequentialBarcodes(startCode: string, count: number): string[] {
  const start = String(startCode || '').trim()
  const total = Math.max(0, Math.floor(Number(count) || 0))
  if (!start || total < 1) return []

  const match = start.match(/^(.*?)(\d+)$/)
  if (!match) {
    return total === 1 ? [start] : []
  }

  const prefix = match[1] ?? ''
  const digits = match[2] ?? ''
  const width = digits.length
  const startNum = Number(digits)
  if (!Number.isFinite(startNum) || startNum < 0) return []

  const codes: string[] = []
  for (let index = 0; index < total; index += 1) {
    const next = startNum + index
    const body = String(next)
    codes.push(`${prefix}${body.length >= width ? body : body.padStart(width, '0')}`)
  }
  return codes
}

export function describeProductionLabelRange(codes: string[]) {
  if (!codes.length) return ''
  if (codes.length === 1) return codes[0]!
  const first = codes[0]!
  const last = codes[codes.length - 1]!
  if (first.includes('|') && last.includes('|')) {
    const firstSeq = first.slice(first.lastIndexOf('|') + 1)
    const lastSeq = last.slice(last.lastIndexOf('|') + 1)
    const base = first.slice(0, first.lastIndexOf('|'))
    return `${base}|${firstSeq} ~ ${lastSeq}`
  }
  return first === last ? first : `${first} ~ ${last}`
}

/** 출력 후 다음에 이어서 쓸 시작 코드 제안 */
export function suggestNextCustomBarcodeStart(codes: string[]) {
  if (!codes.length) return ''
  const last = codes[codes.length - 1]!
  const next = buildSequentialBarcodes(last, 2)
  return next[1] || last
}

function parsePayloadParts(parts: string[]): ProductionLabelPayload | null {
  const head = parts[0]?.toUpperCase()

  if (head === PREFIX.smt_plan && parts[1]) {
    return { kind: 'smt_plan', planId: parts[1] }
  }
  if (head === PREFIX.post_plan && parts[1]) {
    return { kind: 'post_plan', planId: parts[1] }
  }
  if (head === PREFIX.smt_order && parts[1] && parts[2]) {
    const pcbSide =
      parts[2] === 'TOP' || parts[2] === 'BOT' || parts[2] === 'SINGLE' ? parts[2] : null
    if (!pcbSide) return null
    const lineRaw = Number(parts[3] || 0)
    return {
      kind: 'smt_order',
      orderLineId: parts[1],
      pcbSide,
      lineNo: lineRaw >= 1 && lineRaw <= 7 ? lineRaw : null,
    }
  }
  if (head === PREFIX.post_order && parts[1] && parts[2]) {
    return {
      kind: 'post_order',
      assemblyGroupId: parts[1],
      team: parts[2],
    }
  }
  return null
}

export function parseProductionLabelCode(raw: string): ParsedProductionLabel | null {
  const fullCode = String(raw || '').trim()
  if (!fullCode) return null
  const parts = fullCode.split('|').map((part) => part.trim()).filter(Boolean)
  if (parts.length < 2) return null

  const head = parts[0]?.toUpperCase()
  let sequence: number | null = null
  let payloadParts = parts

  const last = parts[parts.length - 1] || ''
  const looksLikeSeq = /^\d{1,8}$/.test(last)
  if (looksLikeSeq) {
    if (head === PREFIX.smt_plan || head === PREFIX.post_plan) {
      if (parts.length >= 3) {
        sequence = Number(last)
        payloadParts = parts.slice(0, 2)
      }
    } else if (head === PREFIX.smt_order || head === PREFIX.post_order) {
      if (parts.length >= 5) {
        sequence = Number(last)
        payloadParts = parts.slice(0, 4)
      }
    }
  }

  const payload = parsePayloadParts(payloadParts)
  if (!payload) return null
  if (sequence != null && (!Number.isFinite(sequence) || sequence < 1)) return null

  const baseCode = buildProductionLabelBase(payload)
  return {
    ...payload,
    fullCode,
    baseCode,
    sequence,
  }
}

export function isProductionLabelCode(raw: string) {
  return parseProductionLabelCode(raw) != null
}

export function productionLabelBasesMatch(a: string, b: string) {
  const left = parseProductionLabelCode(a)
  const right = parseProductionLabelCode(b)
  if (left && right) return left.baseCode === right.baseCode
  return a.trim().toUpperCase() === b.trim().toUpperCase()
}
