'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import {
  createSqueegeeAsset,
  isMissingSqueegeesTable,
  retireSqueegeeAsset,
  type FetchSqueegeesResult,
} from '@/lib/squeegees/repository'
import type { SqueegeeAsset } from '@/lib/squeegees/types'
import { DEFAULT_SQUEEGEE_USE_LIMIT, SQUEEGEE_STATUS_LABELS } from '@/lib/squeegees/types'
import { isSqueegeeNearLimit, squeegeeRemaining } from '@/lib/squeegees/utils'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { useErpConfirm } from '@/components/ui/erp-confirm'
import { ERP_TABLE_HEAD_CLASS, ERP_TABLE_SCROLL_CLASS, ERP_TABLE_WRAP_CLASS } from '@/lib/ui/tokens'

type SqueegeesWorkspaceProps = {
  result: FetchSqueegeesResult
}

function SqueegeeCreateModal({
  open,
  onClose,
  onSaved,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
}) {
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [useLimit, setUseLimit] = useState(String(DEFAULT_SQUEEGEE_USE_LIMIT))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setBarcode('')
    setName('')
    setUseLimit(String(DEFAULT_SQUEEGEE_USE_LIMIT))
    setNote('')
    setSaving(false)
    setError(null)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [open, onClose, saving])

  if (!open) return null

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)

    const created = await createSqueegeeAsset({
      barcode,
      name,
      useLimit: Math.floor(Number(useLimit) || DEFAULT_SQUEEGEE_USE_LIMIT),
      note,
    })

    setSaving(false)

    if (!created.ok) {
      setError(created.detail)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="squeegee-create-title"
        className="flex w-full max-w-md flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 id="squeegee-create-title" className="text-lg font-bold text-slate-900">
              스퀴즈 등록
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              한도 기본 {DEFAULT_SQUEEGEE_USE_LIMIT.toLocaleString('ko-KR')}회
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-2 py-1 text-2xl leading-none text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50"
            aria-label="닫기"
          >
            ×
          </button>
        </div>

        <form onSubmit={(event) => void handleSubmit(event)} className="space-y-3 px-5 py-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">바코드 *</span>
            <input
              type="text"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
              placeholder="바코드 스캔 또는 입력"
              autoComplete="off"
              required
              autoFocus
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-900 outline-none focus:border-sky-400 focus:bg-white focus:ring-2 focus:ring-sky-100"
            />
          </label>

          <div className="grid grid-cols-2 gap-3">
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
          </div>

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

          {error ? <p className="text-sm font-medium text-red-700">{error}</p> : null}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-lg border border-slate-200 px-3.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-50"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={saving || !barcode.trim()}
              className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              {saving ? '등록 중…' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function SqueegeesWorkspace({ result }: SqueegeesWorkspaceProps) {
  const { afterCreate, afterSave } = useSaveFeedback()
  const confirm = useErpConfirm()
  const [search, setSearch] = useState('')
  const [showRetired, setShowRetired] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)

  const [retiringId, setRetiringId] = useState<string | null>(null)
  const [listMessage, setListMessage] = useState<{ text: string; kind: 'ok' | 'err' } | null>(null)

  const assets = result.ok ? result.assets : []
  const query = search.trim().toLowerCase()

  const filtered = useMemo(() => {
    return assets.filter((asset) => {
      if (!showRetired && asset.status === 'retired') return false
      if (!query) return true
      const haystack = [asset.barcode, asset.name, asset.note, asset.status].join(' ').toLowerCase()
      return haystack.includes(query)
    })
  }, [assets, query, showRetired])

  async function handleRetire(asset: SqueegeeAsset) {
    if (
      !(await confirm({
        title: '스퀴즈 교체완료',
        message: `${asset.barcode} 스퀴즈를 교체완료로 처리할까요?`,
        confirmLabel: '교체완료',
        tone: 'default',
      }))
    ) {
      return
    }
    setRetiringId(asset.id)
    setListMessage(null)

    const retired = await retireSqueegeeAsset(asset.id)
    setRetiringId(null)

    if (!retired.ok) {
      setListMessage({ text: retired.detail, kind: 'err' })
      return
    }

    setListMessage({ text: `${retired.asset.barcode} 교체완료 처리됨`, kind: 'ok' })
    afterSave('스퀴즈가 교체완료 처리되었습니다.')
  }

  if (!result.ok) {
    const missingTable = result.reason === 'query' && isMissingSqueegeesTable(result.detail)
    return (
      <FetchErrorBanner
        reason={result.reason}
        title="스퀴즈 목록을 불러오지 못했습니다"
        detail={result.detail}
        hint={
          missingTable ? (
            <>
              Supabase SQL Editor에서{' '}
              <code className="rounded bg-white/70 px-1">setup-squeegees.sql</code>을 실행했는지
              확인하세요.
            </>
          ) : null
        }
      />
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="바코드, 이름, 비고 검색…"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none ring-sky-100 placeholder:text-slate-400 focus:border-sky-300 focus:ring-2 sm:max-w-sm"
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
            {listMessage ? (
              <p
                className={`text-sm font-medium ${
                  listMessage.kind === 'ok' ? 'text-emerald-700' : 'text-red-700'
                }`}
              >
                {listMessage.text}
              </p>
            ) : null}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <p className="text-sm font-medium text-slate-600">
              총{' '}
              <span className="tabular-nums text-sky-700">
                {filtered.length.toLocaleString('ko-KR')}
              </span>
              건
              {query || !showRetired ? (
                <span className="text-slate-400"> / {assets.length.toLocaleString('ko-KR')}건</span>
              ) : null}
            </p>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="rounded-lg bg-slate-800 px-3.5 py-2 text-sm font-bold text-white transition hover:bg-slate-900"
            >
              스퀴즈 등록
            </button>
          </div>
        </div>

        <div className={ERP_TABLE_WRAP_CLASS}>
          <div className={ERP_TABLE_SCROLL_CLASS}>
            <table className="erp-data-table min-w-full border-collapse text-left text-sm">
              <thead className={ERP_TABLE_HEAD_CLASS}>
                <tr>
                  <th className="px-3 py-2.5">바코드</th>
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
                    <td colSpan={7} className="px-3 py-10 text-center text-slate-400">
                      {query ? '검색 결과가 없습니다' : '등록된 스퀴즈가 없습니다'}
                    </td>
                  </tr>
                ) : (
                  filtered.map((asset) => {
                    const remaining = squeegeeRemaining(asset)
                    const near = isSqueegeeNearLimit(asset) && asset.status === 'active'
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
                        <td className="px-3 py-2.5 text-slate-700">{asset.name || '—'}</td>
                        <td className="px-3 py-2.5 text-right tabular-nums text-slate-700">
                          {asset.useCount.toLocaleString('ko-KR')} /{' '}
                          {asset.useLimit.toLocaleString('ko-KR')}
                        </td>
                        <td
                          className={`px-3 py-2.5 text-right font-semibold tabular-nums ${
                            over ? 'text-red-700' : near ? 'text-amber-800' : 'text-slate-800'
                          }`}
                        >
                          {remaining.toLocaleString('ko-KR')}
                          {over ? ' · 초과' : near ? ' · 임박' : ''}
                        </td>
                        <td className="px-3 py-2.5">{SQUEEGEE_STATUS_LABELS[asset.status]}</td>
                        <td className="max-w-[10rem] truncate px-3 py-2.5 text-slate-500">
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

      <SqueegeeCreateModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSaved={() => afterCreate('스퀴즈가 등록되었습니다.')}
      />
    </div>
  )
}
