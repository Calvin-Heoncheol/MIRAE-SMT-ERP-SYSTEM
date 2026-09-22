import { looksLikePackedBomSpec } from '@/lib/items/bom-spec-ai-utils'
import type { BomLine } from '@/lib/quotes/parse-altium-bom'

export type BomSpecSplitResult = {
  comment: string
  footprint: string
  mpn: string
  manufacturer: string
  confidence: 'certain' | 'ambiguous'
  note: string
}

const PACKAGE_TOKEN =
  /^(?:\d{4}|0\d{3}|(?:C|R|L)?0[2-9]\d{2}|(?:SOP|SOIC|SSOP|TSSOP|MSOP|QFN|VQFN|DFN|QFP|LQFP|TQFP|BGA|FBGA|SOT|SOD|SMA|SMB|SMC|DO|TO)[\w.-]*|[A-Z]{1,4}\d{2,4}(?:-\d+)?)$/i

const KNOWN_MANUFACTURERS =
  /^(murata|samsung|tdk|yageo|kemet|avx|vishay|on\s*semi|onsemi|texas\s*instruments|ti|infineon|stmicro|st\s*micro|nxp|analog\s*devices|adi|microchip|renesas|rohm|diodes|lite[\s-]?on|everlight|kingbright|xinshijia|wurth|würth|panasonic|nichicon|rubycon|epcos|bourns|stackpole|susumu|koa)$/i

function looksLikePackageToken(token: string) {
  const t = token.trim()
  if (!t || t.length > 24) return false
  if (PACKAGE_TOKEN.test(t)) return true
  // Altium-style C_0402 / R_0603
  return /^[A-Z]_\d{3,4}$/i.test(t)
}

function looksLikeManufacturerToken(token: string) {
  const t = token.trim()
  if (!t || t.length < 2 || t.length > 48) return false
  if (looksLikePackageToken(t)) return false
  if (KNOWN_MANUFACTURERS.test(t)) return true
  // 순수 영문/공백 제조사명 (숫자 거의 없음)
  if (!/^[A-Za-z][A-Za-z0-9 .&+/-]*$/.test(t)) return false
  const digits = (t.match(/\d/g) || []).length
  if (digits >= 3) return false
  if (/^[A-Z0-9._/-]+$/i.test(t) && /\d/.test(t) && t.length >= 8) return false
  return /^[A-Za-z][A-Za-z .&-]{1,}$/.test(t)
}

function looksLikeMpnToken(token: string) {
  const t = token.trim()
  if (!t || t.length < 6 || t.length > 64) return false
  if (looksLikePackageToken(t)) return false
  if (looksLikeManufacturerToken(t)) return false
  if (!/[A-Za-z]/.test(t) || !/\d/.test(t)) return false
  return /^[A-Z0-9][A-Z0-9._+/-]*$/i.test(t)
}

/**
 * Specification 한 칸에 value·package·MPN·제조사가 섞인 문자열을 분리.
 * 예: `L, wirewound, 18nH, ± 5%, 0402, LQV15CN18NJ00D, MURATA`
 */
export function splitPackedBomSpecification(
  raw: string,
  existing?: { footprint?: string; mpn?: string; manufacturer?: string },
): BomSpecSplitResult {
  const source = raw.trim()
  const footprint0 = existing?.footprint?.trim() || ''
  const mpn0 = existing?.mpn?.trim() || ''
  const manufacturer0 = existing?.manufacturer?.trim() || ''

  if (!source) {
    return {
      comment: '',
      footprint: footprint0,
      mpn: mpn0,
      manufacturer: manufacturer0,
      confidence: 'ambiguous',
      note: '빈 사양',
    }
  }

  if (footprint0 && mpn0) {
    return {
      comment: source,
      footprint: footprint0,
      mpn: mpn0,
      manufacturer: manufacturer0,
      confidence: 'certain',
      note: '컬럼 값 유지',
    }
  }

  const parts = source
    .split(/[,，;|]/)
    .map((part) => part.trim())
    .filter(Boolean)

  if (parts.length < 2) {
    return {
      comment: source,
      footprint: footprint0,
      mpn: mpn0,
      manufacturer: manufacturer0,
      confidence: footprint0 || mpn0 ? 'certain' : 'ambiguous',
      note: '단일 사양',
    }
  }

  let manufacturer = manufacturer0
  let mpn = mpn0
  let footprint = footprint0
  const used = new Set<number>()

  // 끝에서 제조사 → MPN 순으로 후보
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    const token = parts[i]!
    if (!manufacturer && looksLikeManufacturerToken(token)) {
      manufacturer = token
      used.add(i)
      break
    }
  }

  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (used.has(i)) continue
    const token = parts[i]!
    if (!mpn && looksLikeMpnToken(token)) {
      mpn = token
      used.add(i)
      break
    }
  }

  // 패키지는 뒤에서 앞으로 (제조사/MPN 제외)
  for (let i = parts.length - 1; i >= 0; i -= 1) {
    if (used.has(i)) continue
    const token = parts[i]!
    if (!footprint && looksLikePackageToken(token)) {
      if (/^\d{4}$/.test(token)) footprint = token
      else if (/^[A-Z]_\d{3,4}$/i.test(token)) footprint = token.replace(/^[A-Z]_/i, '')
      else footprint = token
      used.add(i)
      break
    }
  }

  const commentParts = parts.filter((_, index) => !used.has(index))
  const comment = commentParts.join(', ') || source
  const extracted = Boolean((!footprint0 && footprint) || (!mpn0 && mpn) || (!manufacturer0 && manufacturer))

  return {
    comment,
    footprint: footprint || footprint0,
    mpn: mpn || mpn0,
    manufacturer: manufacturer || manufacturer0,
    confidence: extracted && (footprint || mpn) ? 'certain' : 'ambiguous',
    note: extracted ? '사양 문자열 분해' : '분해 후보 부족',
  }
}

export function bomLineNeedsSpecNormalize(line: Pick<BomLine, 'comment' | 'description' | 'footprint' | 'mpn'>) {
  const specification = (line.comment || line.description).trim()
  const pkg = line.footprint.trim()
  const mpn = line.mpn.trim()
  if (!specification) return false
  if (pkg && mpn) return false

  // 패키지만 분리된 상태면, 남은 조각에 MPN 후보가 있을 때만 AI 대상
  if (pkg && !mpn) {
    return specification
      .split(/[,，;|]/)
      .map((part) => part.trim())
      .some((part) => looksLikeMpnToken(part))
  }

  return looksLikePackedBomSpec({
    specification,
    package: pkg,
    mpn,
  })
}

export function applyRuleBomSpecNormalize(line: BomLine): BomLine {
  if (!bomLineNeedsSpecNormalize(line)) return line

  const source = (line.comment || line.description).trim()
  const split = splitPackedBomSpecification(source, {
    footprint: line.footprint,
    mpn: line.mpn,
    manufacturer: line.manufacturer,
  })

  if (!split.footprint && !split.mpn && split.comment === source) return line

  return {
    ...line,
    comment: split.comment || line.comment,
    footprint: split.footprint || line.footprint,
    mpn: split.mpn || line.mpn,
    manufacturer: split.manufacturer || line.manufacturer,
    normalizeNote: split.note,
    normalizeSource: 'rules',
  }
}
