'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  applyMetalMaskUsage,
  createMetalMaskAsset,
  findMetalMaskByBarcode,
  isMissingMetalMasksTable,
  retireMetalMaskAsset,
  type FetchMetalMasksResult,
} from '@/lib/metal-masks/repository'
import type { MetalMaskAsset, MetalMaskPcbSide } from '@/lib/metal-masks/types'
import {
  DEFAULT_METAL_MASK_USE_LIMIT,
  METAL_MASK_PCB_SIDE_LABELS,
  METAL_MASK_STATUS_LABELS,
} from '@/lib/metal-masks/types'
import { isMetalMaskNearLimit, metalMaskRemaining } from '@/lib/metal-masks/utils'

type MetalMasksWorkspaceProps = {
  result: FetchMetalMasksResult
}

export function MetalMasksWorkspace({ result }: MetalMasksWorkspaceProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [showRetired, setShowRetired] = useState(false)

  const [usageBarcode, setUsageBarcode] = useState('')
  const [usageQty, setUsageQty] = useState('')
  const [usagePreview, setUsagePreview] = useState<MetalMaskAsset | null>(null)
  const [usageHint, setUsageHint] = useState<string | null>(null)
  const [usageSaving, setUsageSaving] = useState(false)
  const [usageMessage, setUsageMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [pcbSide, setPcbSide] = useState<MetalMaskPcbSide>('SINGLE')
  const [useLimit, setUseLimit] = useState(String(DEFAULT_METAL_MASK_USE_LIMIT))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [retiringId, setRetiringId] = useState<string | null>(null)
  const [message, setMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const assets = result.ok ? result.assets : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
      if (!showRetired && asset.status === 'retired') return false
      if (!query) return true
      const haystack = [asset.barcode, asset.name, asset.note, asset.pcbSide, asset.status]
        .join(' ')
        .toLowerCase()
      return haystack.includes(query)
    })
  }, [assets, query, showRetired])

  useEffect(() => {
    const code = usageBarcode.trim()
    if (!code) {
      setUsagePreview(null)
      setUsageHint(null)
      return
    }

    let cancelled = false
    const timer = setTimeout(() => {
      void findMetalMaskByBarcode(code).then((found) => {
        if (cancelled) return
        if (!found.ok) {
          setUsagePreview(null)
          setUsageHint(found.detail)
          return
        }
        if (!found.asset) {
          setUsagePreview(null)
          setUsageHint('미등록 바코드입니다. 아래에서 먼저 등록해 주세요.')
          return
        }
        if (found.asset.status !== 'active') {
          setUsagePreview(found.asset)
          setUsageHint('교체완료된 마스크입니다.')
          return
        }
        setUsagePreview(found.asset)
        const remaining = metalMaskRemaining(found.asset)
        setUsageHint(
          isMetalMaskNearLimit(found.asset)
            ? `교체 임박 · ${METAL_MASK_PCB_SIDE_LABELS[found.asset.pcbSide]} · 잔여 ${remaining.toLocaleString('ko-KR')}회`
            : `${METAL_MASK_PCB_SIDE_LABELS[found.asset.pcbSide]} · 잔여 ${remaining.toLocaleString('ko-KR')}회 / ${found.asset.useLimit.toLocaleString('ko-KR')}`,
        )
      })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [usageBarcode])

  async function handleUsage(event: React.FormEvent) {
    event.preventDefault()
    const code = usageBarcode.trim()
    const delta = Math.floor(Number(usageQty) || 0)
    if (!code) {
      setUsageMessage({ text: '바코드를 스캔해 주세요.', kind: 'err' })
      return
    }
    if (delta < 1) {
      setUsageMessage({ text: '사용 횟수는 1 이상이어야 합니다.', kind: 'err' })
      return
    }

    setUsageSaving(true)
    setUsageMessage(null)

    const found = await findMetalMaskByBarcode(code)
    if (!found.ok) {
      setUsageSaving(false)
      setUsageMessage({ text: found.detail, kind: 'err' })
      return
    }
    if (!found.asset) {
      setUsageSaving(false)
      setUsageMessage({ text: '등록되지 않은 마스크 바코드입니다.', kind: 'err' })
      return
    }

    const applied = await applyMetalMaskUsage({
      barcode: code,
      pcbSide: found.asset.pcbSide,
      deltaQty: delta,
    })

    setUsageSaving(false)

    if (!applied.ok) {
      setUsageMessage({ text: applied.detail, kind: 'err' })
      return
    }

    const remaining = metalMaskRemaining(applied.asset)
    setUsagePreview(applied.asset)
    setUsageQty('')
    setUsageHint(
      `잔여 ${remaining.toLocaleString('ko-KR')}회 / ${applied.asset.useLimit.toLocaleString('ko-KR')}`,
    )
    setUsageMessage({
      text: `${delta.toLocaleString('ko-KR')}회 가산 · 잔여 ${remaining.toLocaleString('ko-KR')}회`,
      kind: 'ok',
    })
    router.refresh()
  }

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setMessage(null)

    const created = await createMetalMaskAsset({
      barcode,
      name,
      pcbSide,
      useLimit: Math.floor(Number(useLimit) || DEFAULT_METAL_MASK_USE_LIMIT),
      note,
    })

    setSaving(false)

    if (!created.ok) {
      setMessage({ text: created.detail, kind: 'err' })
      return
    }

    setBarcode('')
    setName('')
    setNote('')
    setUseLimit(String(DEFAULT_METAL_MASK_USE_LIMIT))
    setPcbSide('SINGLE')
    setMessage({ text: `등록 완료: ${created.asset.barcode}`, kind: 'ok' })
    router.refresh()
  }

  async function handleRetire(asset: MetalMaskAsset) {
    if (!window.confirm(`${asset.barcode} 마스크를 교체완료로 처리할까요?`)) return
    setRetiringId(asset.id)
    setMessage(null)

    const retired = await retireMetalMaskAsset(asset.id)
    setRetiringId(null)

    if (!retired.ok) {
      setMessage({ text: retired.detail, kind: 'err' })
      return
    }

    setMessage({ text: `${retired.asset.barcode} 교체완료 처리됨`, kind: 'ok' })
    router.refresh()
  }

  if (!result.ok) {
    const missingTable = result.reason === 'query' && isMissingMetalMasksTable(result.detail)
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900">
        <p className="font-semibold">
          {result.reason === 'env' ? '환경변수 필요' : '메탈마스크 목록을 불러오지 못했습니다'}
        </p>
        <p className="mt-1 whitespace-pre-wrap">{result.detail}</p>
        {missingTable ? (
          <p className="mt-3 text-amber-800">
            Supabase SQL Editor에서{' '}
            <code className="rounded bg-amber-100 px-1">setup-metal-masks.sql</code>을 실행했는지
            확인하세요.
          </p>
        ) : null}
      </div>
    )
  }

  const usageOk =
    usagePreview &&
    usagePreview.status === 'active' &&
    usageBarcode.trim() === usagePreview.barcode

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <div className="grid gap-3 lg:grid-cols-2 lg:items-stretch">
        <form
          onSubmit={(event) => void handleCreate(event)}
          className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm"
        >
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-800 text-[11px] font-bold text-white">
              1
            </span>
            마스크 등록
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            바코드·면 등록 · 한도 기본 {DEFAULT_METAL_MASK_USE_LIMIT.toLocaleString('ko-KR')}회
          </p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">바코드 *</span>
              <input
                type="text"
                value={barcode}
                onChange={(event) => setBarcode(event.target.value)}
                placeholder="바코드 스캔 또는 입력"
                autoComplete="off"
                required
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">면 *</span>
              <select
                value={pcbSide}
                onChange={(event) => setPcbSide(event.target.value as MetalMaskPcbSide)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              >
                {(Object.keys(METAL_MASK_PCB_SIDE_LABELS) as MetalMaskPcbSide[]).map((side) => (
                  <option key={side} value={side}>
                    {METAL_MASK_PCB_SIDE_LABELS[side]}
                  </option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">한도</span>
              <input
                type="number"
                min={1}
                step={1}
                value={useLimit}
                onChange={(event) => setUseLimit(event.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">표시명</span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="선택"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">비고</span>
              <input
                type="text"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder="선택"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={saving || !barcode.trim()}
              className="rounded-lg bg-slate-800 px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? '등록 중…' : '자산 등록'}
            </button>
            {message ? (
              <p
                className={`text-sm font-medium ${
                  message.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {message.text}
              </p>
            ) : null}
          </div>
        </form>

        <form
          onSubmit={(event) => void handleUsage(event)}
          className="rounded-xl border border-sky-200 bg-sky-50/40 p-3.5 shadow-sm"
        >
          <h2 className="flex items-center gap-2 text-sm font-bold text-slate-900">
            <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-600 text-[11px] font-bold text-white">
              2
            </span>
            사용횟수 입력
          </h2>
          <p className="mt-1 text-xs text-slate-500">바코드 스캔 후 가산 · 한도 초과 시 차단</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            <label className="block text-sm sm:col-span-2">
              <span className="mb-1 block font-medium text-slate-600">바코드 *</span>
              <input
                type="text"
                value={usageBarcode}
                onChange={(event) => {
                  setUsageBarcode(event.target.value)
                  setUsageMessage(null)
                }}
                placeholder="바코드 스캔 또는 입력"
                autoComplete="off"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">가산 횟수 *</span>
              <input
                type="number"
                min={1}
                step={1}
                value={usageQty}
                onChange={(event) => {
                  setUsageQty(event.target.value)
                  setUsageMessage(null)
                }}
                placeholder="0"
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums text-slate-900 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100"
              />
            </label>
          </div>

          {usageHint ? (
            <p
              className={`mt-2 text-xs font-medium ${
                usageOk
                  ? isMetalMaskNearLimit(usagePreview)
                    ? 'text-amber-700'
                    : 'text-slate-600'
                  : 'text-red-600'
              }`}
            >
              {usageHint}
            </p>
          ) : null}

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="submit"
              disabled={usageSaving || !usageBarcode.trim() || Math.floor(Number(usageQty) || 0) < 1}
              className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-sm font-bold text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {usageSaving ? '등록 중…' : '횟수 등록'}
            </button>
            {usageMessage ? (
              <p
                className={`text-sm font-medium ${
                  usageMessage.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {usageMessage.text}
              </p>
            ) : null}
          </div>
        </form>
      </div>

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="바코드, 이름, 비고 검색…"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-100 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2"
          />
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input
              type="checkbox"
              checked={showRetired}
              onChange={(event) => setShowRetired(event.target.checked)}
              className="rounded border-slate-300"
            />
            교체완료 포함
          </label>
        </div>
        <p className="text-sm font-medium text-slate-600">
          총 <span className="tabular-nums text-sky-700">{filtered.length.toLocaleString('ko-KR')}</span>건
          {query || !showRetired ? (
            <span className="text-slate-400"> / {assets.length.toLocaleString('ko-KR')}건</span>
          ) : null}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-3 py-2.5">바코드</th>
              <th className="px-3 py-2.5">면</th>
              <th className="px-3 py-2.5">이름</th>
              <th className="px-3 py-2.5 text-right">사용/한도</th>
              <th className="px-3 py-2.5 text-right">잔여</th>
              <th className="px-3 py-2.5">상태</th>
              <th className="px-3 py-2.5">비고</th>
              <th className="px-3 py-2.5 text-right">작업</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-10 text-center text-slate-400">
                  {query ? '검색 결과가 없습니다' : '등록된 메탈마스크가 없습니다'}
                </td>
              </tr>
            ) : (
              filtered.map((asset) => {
                const remaining = metalMaskRemaining(asset)
                const near = isMetalMaskNearLimit(asset) && asset.status === 'active'
                const over = remaining <= 0 && asset.status === 'active'
                return (
                  <tr
                    key={asset.id}
                    className={`border-t border-slate-100 ${
                      over
                        ? 'bg-red-50/80'
                        : near
                          ? 'bg-amber-50/70'
                          : asset.status === 'retired'
                            ? 'bg-slate-50 text-slate-500'
                            : 'bg-white'
                    }`}
                  >
                    <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900">
                      {asset.barcode}
                    </td>
                    <td className="px-3 py-2.5 font-medium text-slate-700">
                      {METAL_MASK_PCB_SIDE_LABELS[asset.pcbSide]}
                    </td>
                    <td className="px-3 py-2.5 text-slate-700">{asset.name || '—'}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                      {asset.useCount.toLocaleString('ko-KR')} / {asset.useLimit.toLocaleString('ko-KR')}
                    </td>
                    <td
                      className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                        over ? 'text-red-700' : near ? 'text-amber-800' : 'text-slate-800'
                      }`}
                    >
                      {remaining.toLocaleString('ko-KR')}
                      {over ? ' · 초과' : near ? ' · 임박' : ''}
                    </td>
                    <td className="px-3 py-2.5">{METAL_MASK_STATUS_LABELS[asset.status]}</td>
                    <td className="max-w-[12rem] truncate px-3 py-2.5 text-slate-500">
                      {asset.note || '—'}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      {asset.status === 'active' ? (
                        <button
                          type="button"
                          disabled={retiringId === asset.id}
                          onClick={() => void handleRetire(asset)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:border-amber-300 hover:bg-amber-50 hover:text-amber-900 disabled:opacity-40"
                        >
                          {retiringId === asset.id ? '처리 중…' : '교체완료'}
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
