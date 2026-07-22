/**
 * 인증 강제 여부.
 * - AUTH_ENABLED=true 일 때만 로그인 필수
 * - 그 외(미설정·false)는 기존처럼 로그인 없이 사용 (개발 중 기본)
 */
export function isAuthDisabled() {
  return process.env.AUTH_ENABLED !== 'true'
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
