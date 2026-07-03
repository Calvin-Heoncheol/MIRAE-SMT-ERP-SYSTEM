'use client'

import { useEffect, useState } from 'react'
import type { PostProcessOrderLine } from '@/lib/post-process/types'
import {
  formatPostProductName,
  getProgressPercent,
  resolvePostCount,
} from '@/lib/post-process/utils'

type PostInputPanelProps = {
  order: PostProcessOrderLine | null
  counts: Record<string, number>
}

export function PostInputPanel({ order, counts }: PostInputPanelProps) {
  const [qty, setQty] = useState('')
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const cumulative = order ? resolvePostCount(order, counts) : 0
  const target = order ? Math.max(0, Math.floor(order.quantity)) : 0
  const progress = getProgressPercent(cumulative, target)
  const remaining = Math.max(0, target - cumulative)
  const canRegister = Boolean(order) && remaining > 0

  useEffect(() => {
    setQty('')
    setMessage(null)
  }, [order?.uiKey])

  function handleSubmit() {
    if (!order) return
    const value = Math.floor(Number(qty))
    if (!value || value < 1) {
      setMessage({ text: '등록 수량을 입력하세요.', kind: 'err' })
      return
    }
    if (target > 0 && value > remaining) {
      setMessage({ text: `남은 수량(${remaining.toLocaleString('ko-KR')})을 초과할 수 없습니다.`, kind: 'err' })
      return
    }
    setMessage({
      text: '후공정 생산 기록 저장은 DB 연동 후 사용 가능합니다.',
      kind: 'err',
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gradient-to-b from-sky-50 to-white px-5 py-5 shadow-[inset_0_3px_0_#0284c7]">
      <div className="mb-3 shrink-0 border-b border-slate-200 pb-2.5">
        <span className="block truncate text-xs font-semibold text-slate-500">
          {order ? `${order.orderNumber} · ${order.customer}` : '— 주문 미선택 —'}
        </span>
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="shrink-0 px-1 py-2 text-center">
          {order ? (
            <span className="inline-block rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[11px] font-extrabold text-sky-700">
              {order.productKindLabel}
            </span>
          ) : null}
          <div
            className={`mt-2 text-[clamp(20px,3.2vw,28px)] leading-tight font-extrabold break-keep ${
              order ? 'text-slate-900' : 'text-base font-semibold text-slate-400'
            }`}
          >
            {order ? formatPostProductName(order) : '주문을 선택하세요'}
          </div>
          <div className="mt-2.5 flex flex-wrap justify-center gap-x-4 gap-y-1 text-[13px]">
            <span>
              <span className="mr-1 text-[11px] font-bold text-slate-400">고객</span>
              <span className="font-extrabold text-slate-700">{order?.customer || '—'}</span>
            </span>
            <span>
              <span className="mr-1 text-[11px] font-bold text-slate-400">주문</span>
              <span className="font-extrabold text-slate-700">{order?.orderNumber || '—'}</span>
            </span>
          </div>
        </div>

        <div className="flex shrink-0 items-end justify-center gap-2.5 py-4">
          <div className="min-w-16 text-center">
            <span className="block text-[11px] font-bold text-slate-500">누적</span>
            <span className="block text-[clamp(32px,5vw,48px)] leading-none font-black text-emerald-700 tabular-nums">
              {cumulative.toLocaleString('ko-KR')}
            </span>
          </div>
          <span className="pb-1.5 text-3xl font-light text-slate-300">/</span>
          <div className="min-w-16 text-center">
            <span className="block text-[11px] font-bold text-slate-500">목표</span>
            <span className="block text-[clamp(32px,5vw,48px)] leading-none font-black text-slate-700 tabular-nums">
              {target.toLocaleString('ko-KR')}
            </span>
          </div>
        </div>

        {order && target > 0 ? (
          <div className="mx-auto w-full max-w-md shrink-0 px-2 pb-4">
            <div className="mb-1 flex justify-between text-xs font-semibold text-slate-600">
              <span>진행률</span>
              <span className="tabular-nums">{progress}%</span>
            </div>
            <div className="h-3.5 overflow-hidden rounded-full border border-slate-300 bg-slate-200">
              <div
                className={`h-full rounded-full transition-all ${
                  cumulative >= target
                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-800'
                    : 'bg-gradient-to-r from-emerald-400 to-emerald-700'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        ) : null}

        <div className="mt-auto shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label htmlFor="post-qty-input" className="mb-2 block text-sm font-semibold text-slate-600">
            이번 등록 수량
          </label>
          <div className="flex gap-2">
            <input
              id="post-qty-input"
              type="number"
              min={1}
              step={1}
              value={qty}
              disabled={!canRegister}
              onChange={(event) => setQty(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') handleSubmit()
              }}
              placeholder="0"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-3 text-lg font-bold text-slate-900 tabular-nums outline-none ring-emerald-100 focus:border-emerald-400 focus:ring-2 disabled:bg-slate-100 disabled:text-slate-400"
            />
            <button
              type="button"
              disabled={!canRegister}
              onClick={handleSubmit}
              className="shrink-0 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-700 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-45"
            >
              등록
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {order
              ? remaining > 0
                ? `남은 수량 ${remaining.toLocaleString('ko-KR')}개`
                : '목표 수량에 도달했습니다.'
              : '왼쪽에서 주문을 선택하세요.'}
          </p>
        </div>

        {message ? (
          <p className={`mt-3 text-center text-sm font-medium ${message.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  )
}
