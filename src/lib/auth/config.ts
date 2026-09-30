/**
 * 인증 강제 여부.
 * - production: 항상 ON. AUTH_ENABLED=false 는 무시하고 경고만 남김.
 * - development: 기본 OFF (AUTH_ENABLED=true 일 때만 켬)
 */
export function isAuthDisabled() {
  if (process.env.NODE_ENV === 'production') {
    if (process.env.AUTH_ENABLED === 'false') {
      console.error(
        '[auth] AUTH_ENABLED=false 는 production에서 허용되지 않습니다. 인증을 강제합니다.',
      )
    }
    return false
  }
  return process.env.AUTH_ENABLED !== 'true'
}

/** 신규 계정 초기 비밀번호 (로그인 후 변경 강제) */
export const DEFAULT_INITIAL_PASSWORD = '123123'

/** 사용자가 직접 정하는 비밀번호 최소 길이 */
export const MIN_PASSWORD_LENGTH = 8

/** 로그인 후 이동 경로 — 같은 사이트 내부 경로만 허용 (`//host`, `/\host` 차단) */
export function safeRedirectPath(value: string | null | undefined) {
  const path = String(value || '').trim()
  if (!path.startsWith('/') || path.startsWith('//') || path.startsWith('/\\')) return '/'
  return path
}

/** 개발 환경에서 로그인 페이지 진입 시 자동 로그인 */
export function isAuthDevAutoLoginEnabled() {
  if (process.env.NODE_ENV === 'production') return false
  if (isAuthDisabled()) return false
  return process.env.AUTH_DEV_AUTO_LOGIN === 'true'
}

export function getAuthDevCredentials() {
  const email = (process.env.AUTH_DEV_EMAIL || '').trim()
  const password = process.env.AUTH_DEV_PASSWORD || ''
  if (!email || !password) return null
  return { email, password }
}
