import { describe, expect, it } from 'vitest'
import { safeRedirectPath } from './config'

describe('safeRedirectPath', () => {
  it('앱 내부 경로는 그대로 둔다', () => {
    expect(safeRedirectPath('/orders')).toBe('/orders')
    expect(safeRedirectPath('/delivery/input?uiKey=abc')).toBe('/delivery/input?uiKey=abc')
  })

  it('외부 주소·프로토콜 상대 주소는 / 로 막는다', () => {
    expect(safeRedirectPath('https://evil.example')).toBe('/')
    expect(safeRedirectPath('//evil.example')).toBe('/')
    expect(safeRedirectPath('/\\evil.example')).toBe('/')
    expect(safeRedirectPath('javascript:alert(1)')).toBe('/')
  })

  it('빈 값은 / 로 보낸다', () => {
    expect(safeRedirectPath(null)).toBe('/')
    expect(safeRedirectPath(undefined)).toBe('/')
    expect(safeRedirectPath('   ')).toBe('/')
  })
})
