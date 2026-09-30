import { describe, expect, it } from 'vitest'
import { escapeHtml } from './escape-html'

describe('escapeHtml', () => {
  it('HTML 특수문자를 모두 이스케이프한다', () => {
    expect(escapeHtml(`<img src="x" onerror='a&b'>`)).toBe(
      '&lt;img src=&quot;x&quot; onerror=&#39;a&amp;b&#39;&gt;',
    )
  })

  it('일반 문자열은 바꾸지 않는다', () => {
    expect(escapeHtml('미래 SMT 123')).toBe('미래 SMT 123')
  })
})
