'use client'

import { useMemo, useState } from 'react'
import { useAuthProfile } from '@/components/auth/auth-profile-provider'
import { useBusy } from '@/components/ui/busy-provider'
import { FetchErrorBanner } from '@/components/ui/fetch-error-banner'
import { PageShell } from '@/components/ui/page-shell'
import { useSaveFeedback } from '@/hooks/use-save-feedback'
import { useWriteFailureToast } from '@/hooks/use-write-failure-toast'
import { DEFAULT_QUOTE_RATES, type QuoteRates } from '@/lib/quotes/constants'
import {
  diffQuoteRates,
  formValuesToQuoteRates,
  QUOTE_RATE_COMMON_GROUPS,
  QUOTE_RATE_SET_GROUPS,
  quoteRatesToFormValues,
  type QuoteRateFormValues,
} from '@/lib/quotes/rate-fields'
import {
  saveQuoteRates,
  type FetchQuoteRateHistoryResult,
  type QuoteRateVersion,
} from '@/lib/quotes/rate-repository'

type QuoteRateWorkspaceProps = {
  result: FetchQuoteRateHistoryResult
}

const INPUT_CLASS =
  'w-28 rounded-md border border-slate-300 bg-white px-2 py-1 text-right text-sm tabular-nums text-slate-900 focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100 disabled:bg-slate-50 disabled:text-slate-500'

function formatDateTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function QuoteRateWorkspace({ result }: QuoteRateWorkspaceProps) {
  const { profile, authDisabled } = useAuthProfile()
  const canEdit = authDisabled || profile?.role === 'admin'
  const busyUi = useBusy()
  const { afterSave } = useSaveFeedback()
  const { notifyAuthOrFailure } = useWriteFailureToast()

  const versions = useMemo(() => (result.ok ? result.versions : []), [result])
  const current: QuoteRates = versions[0]?.rates ?? DEFAULT_QUOTE_RATES
  const [values, setValues] = useState<QuoteRateFormValues>(() => quoteRatesToFormValues(current))
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const currentValues = useMemo(() => quoteRatesToFormValues(current), [current])
  const parsed = useMemo(() => formValuesToQuoteRates(values), [values])
  const pendingChanges = parsed.ok ? diffQuoteRates(current, parsed.rates) : []

  if (!result.ok) {
    return <FetchErrorBanner reason={result.reason} title="견적 단가를 불러오지 못했습니다" detail={result.detail} />
  }

  function updateValue(key: string, value: string) {
    setValues((prev) => ({ ...prev, [key]: value }))
  }

  function loadVersion(version: QuoteRateVersion | null) {
    setValues(quoteRatesToFormValues(version?.rates ?? DEFAULT_QUOTE_RATES))
    setError(null)
  }

  async function handleSave() {
    if (!parsed.ok) {
      setError(parsed.error)
      return
    }
    if (!pendingChanges.length) {
      setError('변경된 단가가 없습니다.')
      return
    }
    setSaving(true)
    setError(null)
    const saveResult = await busyUi.run(() => saveQuoteRates(parsed.rates, note))
    setSaving(false)
    if (!saveResult.ok) {
      if (!notifyAuthOrFailure(saveResult)) setError(saveResult.detail)
      return
    }
    setNote('')
    afterSave('견적 단가가 변경되었습니다. 이후 작성하는 견적부터 적용됩니다.')
  }

  function renderInput(key: string) {
    const changed = values[key] !== currentValues[key]
    return (
      <input
        type="number"
        inputMode="decimal"
        min={0}
        step="any"
        value={values[key] ?? ''}
        onChange={(event) => updateValue(key, event.target.value)}
        disabled={!canEdit || saving}
        className={`${INPUT_CLASS} ${changed ? 'border-amber-400 bg-amber-50' : ''}`}
      />
    )
  }

  return (
    <PageShell>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-6">
        {result.tableMissing ? (
          <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            단가표 테이블이 없어 기본 단가를 표시합니다. Supabase SQL Editor에서{' '}
            <code className="rounded bg-white/70 px-1">supabase/migrate-quote-rate-versions.sql</code> 을 실행해 주세요.
          </div>
        ) : null}

        <section className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <p className="font-semibold text-slate-900">
            현재 적용 단가{' '}
            <span className="font-normal text-slate-500">
              {versions[0]
                ? `· ${formatDateTime(versions[0].createdAt)} ${versions[0].createdByName || ''}`
                : '· 기본 단가 (변경 이력 없음)'}
            </span>
          </p>
          <p className="mt-1 text-xs text-slate-500">
            단가를 바꾸면 이후 새로 작성하는 견적부터 적용됩니다. 이미 저장된 견적은 저장 당시 단가로 계산되어 금액이 바뀌지 않습니다.
            {canEdit ? '' : ' 단가 변경은 관리자만 할 수 있습니다.'}
          </p>
        </section>

        <div className="grid gap-4 xl:grid-cols-2">
          <section className="rounded-lg border border-slate-200 bg-white">
            <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-900">국내 / 해외 단가</h2>
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-600">
                <tr>
                  <th className="px-4 py-2 text-left font-semibold">항목</th>
                  <th className="px-2 py-2 text-right font-semibold">국내</th>
                  <th className="px-2 py-2 text-right font-semibold">해외</th>
                  <th className="px-4 py-2 text-left font-semibold">단위</th>
                </tr>
              </thead>
              {QUOTE_RATE_SET_GROUPS.map((group) => (
                <tbody key={group.title} className="border-t border-slate-100">
                  <tr>
                    <td colSpan={4} className="bg-slate-50/60 px-4 py-1.5 text-xs font-bold text-slate-500">
                      {group.title}
                    </td>
                  </tr>
                  {group.fields.map((field) => (
                    <tr key={field.path}>
                      <td className="px-4 py-1.5 text-slate-800">{field.label}</td>
                      <td className="px-2 py-1.5 text-right">{renderInput(`domestic.${field.path}`)}</td>
                      <td className="px-2 py-1.5 text-right">{renderInput(`export.${field.path}`)}</td>
                      <td className="px-4 py-1.5 text-xs text-slate-500">{field.unit}</td>
                    </tr>
                  ))}
                </tbody>
              ))}
            </table>
          </section>

          <div className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white">
              <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-900">공통</h2>
              <table className="w-full text-sm">
                {QUOTE_RATE_COMMON_GROUPS.map((group) => (
                  <tbody key={group.title} className="border-t border-slate-100 first:border-t-0">
                    <tr>
                      <td colSpan={3} className="bg-slate-50/60 px-4 py-1.5 text-xs font-bold text-slate-500">
                        {group.title}
                      </td>
                    </tr>
                    {group.fields.map((field) => (
                      <tr key={field.path}>
                        <td className="px-4 py-1.5 text-slate-800">{field.label}</td>
                        <td className="px-2 py-1.5 text-right">{renderInput(field.path)}</td>
                        <td className="w-20 px-4 py-1.5 text-xs text-slate-500">{field.unit}</td>
                      </tr>
                    ))}
                  </tbody>
                ))}
              </table>
            </section>

            {canEdit ? (
              <section className="space-y-3 rounded-lg border border-slate-200 bg-white px-4 py-3">
                <h2 className="text-sm font-bold text-slate-900">변경 저장</h2>
                {pendingChanges.length ? (
                  <ul className="space-y-0.5 text-xs text-slate-700">
                    {pendingChanges.map((change) => (
                      <li key={change.key}>
                        {change.label}: <span className="text-slate-500">{change.from}</span> →{' '}
                        <span className="font-semibold text-amber-700">{change.to}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-slate-500">변경된 항목이 없습니다.</p>
                )}
                <input
                  type="text"
                  value={note}
                  onChange={(event) => setNote(event.target.value)}
                  placeholder="변경 사유 (예: 2027년 인건비 인상 반영)"
                  disabled={saving}
                  className="w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-100"
                />
                {error ? <p className="text-xs font-medium text-rose-600">{error}</p> : null}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => loadVersion(versions[0] ?? null)}
                    disabled={saving || !pendingChanges.length}
                    className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    되돌리기
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSave()}
                    disabled={saving || !pendingChanges.length || result.tableMissing}
                    className="rounded-md bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
                  >
                    {saving ? '저장 중…' : '새 단가로 저장'}
                  </button>
                </div>
              </section>
            ) : null}
          </div>
        </div>

        <section className="rounded-lg border border-slate-200 bg-white">
          <h2 className="border-b border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-900">변경 이력</h2>
          {versions.length ? (
            <ul className="divide-y divide-slate-100">
              {versions.map((version, index) => {
                const previous = versions[index + 1]?.rates ?? DEFAULT_QUOTE_RATES
                const changes = diffQuoteRates(previous, version.rates)
                return (
                  <li key={version.id} className="flex flex-wrap items-start justify-between gap-3 px-4 py-2.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-slate-900">
                        {formatDateTime(version.createdAt)}
                        <span className="ml-2 font-normal text-slate-500">{version.createdByName}</span>
                        {index === 0 ? (
                          <span className="ml-2 rounded bg-sky-100 px-1.5 py-0.5 text-[11px] font-bold text-sky-700">현재</span>
                        ) : null}
                      </p>
                      {version.note ? <p className="mt-0.5 text-slate-700">{version.note}</p> : null}
                      <p className="mt-0.5 text-xs text-slate-500">
                        {changes.length
                          ? changes.map((change) => `${change.label} ${change.from}→${change.to}`).join(' · ')
                          : '변경 항목 없음'}
                      </p>
                    </div>
                    {canEdit && index > 0 ? (
                      <button
                        type="button"
                        onClick={() => loadVersion(version)}
                        disabled={saving}
                        className="shrink-0 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        이 단가 불러오기
                      </button>
                    ) : null}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="px-4 py-6 text-center text-sm text-slate-500">변경 이력이 없습니다. 현재 기본 단가가 적용 중입니다.</p>
          )}
        </section>
      </div>
    </PageShell>
  )
}
