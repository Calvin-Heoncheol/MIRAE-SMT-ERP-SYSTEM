/**
 * 입고 바코드 스캔 실수 방지
 * - 같은 코드 연속 스캔(스캐너 이중 발사)
 * - 수량 칸에 바코드가 들어가는 경우
 */

export const SCAN_DEDUP_MS = 700
/** 릴 수량으로 현실적인 자릿수 상한 (이보다 길면 바코드로 간주) */
export const QTY_MAX_DIGITS = 7

export function looksLikeBarcodeNotQuantity(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/[^0-9]/.test(trimmed)) return true
  if (trimmed.length > QTY_MAX_DIGITS) return true
  return false
}

/** 동일 바코드가 짧은 시간에 다시 들어오면 무시 */
export function createScanDeduper(cooldownMs = SCAN_DEDUP_MS) {
  let lastCode = ''
  let lastAt = 0

  return {
    /** true면 이번 스캔을 처리해도 됨 */
    accept(code: string): boolean {
      const normalized = code.trim().toLowerCase()
      if (!normalized) return true
      const now = Date.now()
      if (normalized === lastCode && now - lastAt < cooldownMs) {
        return false
      }
      lastCode = normalized
      lastAt = now
      return true
    },
    remember(code: string) {
      const normalized = code.trim().toLowerCase()
      if (!normalized) return
      lastCode = normalized
      lastAt = Date.now()
    },
    reset() {
      lastCode = ''
      lastAt = 0
    },
  }
}

/**
 * 스캐너처럼 짧은 시간에 많은 키가 들어오는지 감지.
 * (수량 칸에 바코드가 쏟아질 때)
 */
export function createKeyBurstDetector(windowMs = 100, minChars = 5) {
  let windowStart = 0
  let count = 0

  return {
    noteChar() {
      const now = Date.now()
      if (now - windowStart > windowMs) {
        windowStart = now
        count = 1
        return
      }
      count += 1
    },
    isBurst() {
      return count >= minChars && Date.now() - windowStart <= windowMs + 50
    },
    reset() {
      windowStart = 0
      count = 0
    },
  }
}

export const QTY_BARCODE_REJECT_MESSAGE =
  '수량 칸에 바코드가 입력되었습니다. 숫자만 입력해 주세요.'

export const SCAN_DEDUP_MESSAGE = '같은 바코드가 연속으로 인식되어 한 번만 반영했습니다.'
