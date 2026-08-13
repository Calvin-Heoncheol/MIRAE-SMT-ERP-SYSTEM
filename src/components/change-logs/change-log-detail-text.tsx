'use client'

import type { ReactNode } from 'react'

function splitReason(detail: string) {
  const text = String(detail || '').trim()
  for (const marker of ['\n사유: ', ' · 사유: ', '\n사유:', ' · 사유:']) {
    const at = text.indexOf(marker)
    if (at >= 0) {
      return {
        body: text.slice(0, at).trim(),
        reason: text.slice(at + marker.length).trim(),
      }
    }
  }
  if (text.startsWith('사유:')) {
    return { body: '', reason: text.slice(3).trim() }
  }
  return { body: text, reason: '' }
}

/** 「라벨 1,000 → 2,000」에서 전·후 금액을 다른 굵기/색으로 */
function renderLineWithPriceChange(line: string, key: string): ReactNode {
  const match = line.match(/^(.*?)(₩?\d[\d,]*)\s*→\s*(₩?\d[\d,]*)(.*)$/)
  if (!match) {
    return (
      <span key={key} className="text-slate-600">
        {line}
      </span>
    )
  }

  const [, prefix, before, after, suffix] = match
  const increase = prefix.includes('가격인상')
  const decrease = prefix.includes('가격인하')

  const prefixNode = (() => {
    if (increase) {
      const tagged = prefix.match(/^(가격인상 ↑)\s*(.*)$/)
      if (tagged) {
        return (
          <>
            <span className="font-semibold text-rose-600">{tagged[1]}</span>
            {tagged[2] ? <span className="text-slate-600">{` ${tagged[2]}`}</span> : null}
          </>
        )
      }
    }
    if (decrease) {
      const tagged = prefix.match(/^(가격인하 ↓)\s*(.*)$/)
      if (tagged) {
        return (
          <>
            <span className="font-semibold text-sky-600">{tagged[1]}</span>
            {tagged[2] ? <span className="text-slate-600">{` ${tagged[2]}`}</span> : null}
          </>
        )
      }
    }
    return <span className="text-slate-600">{prefix}</span>
  })()

  return (
    <span key={key}>
      {prefixNode}
      <span className="font-normal text-slate-400 tabular-nums">{before}</span>
      <span className="mx-1 text-slate-400">→</span>
      <span className="font-bold text-slate-900 tabular-nums">{after}</span>
      {suffix ? <span className="text-slate-600">{suffix}</span> : null}
    </span>
  )
}

function bodyLines(body: string) {
  if (!body) return []
  if (body.includes('\n')) {
    return body.split('\n').map((line) => line.trim()).filter(Boolean)
  }
  // 레거시: · 구분
  return body.split(' · ').map((line) => line.trim()).filter(Boolean)
}

/** 변경이력 detail — 줄바꿈, 전 단가 흐리게 / 후 단가 진하게, 사유는 다음 줄 */
export function ChangeLogDetailText({ detail }: { detail: string }) {
  const { body, reason } = splitReason(detail)
  if (!body && !reason) return null

  const lines = bodyLines(body)

  return (
    <div className="mt-1 space-y-1 text-xs leading-relaxed">
      {lines.map((line, index) => (
        <p key={`line-${index}`}>{renderLineWithPriceChange(line, `line-${index}`)}</p>
      ))}
      {reason ? (
        <p className="rounded-md bg-slate-100/80 px-2 py-1 text-slate-700">
          <span className="font-medium text-slate-500">사유</span>
          <span className="mx-1.5 text-slate-300">|</span>
          <span>{reason}</span>
        </p>
      ) : null}
    </div>
  )
}
