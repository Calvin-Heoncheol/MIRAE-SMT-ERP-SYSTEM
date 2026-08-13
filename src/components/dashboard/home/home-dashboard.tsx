'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { ErpModal } from '@/components/ui/erp-modal'
import type {
  HomeAttentionItem,
  HomeDashboardData,
  HomeHeadlineMetric,
  HomeProductionTeam,
  HomeTeamProductionRow,
} from '@/lib/dashboard/home-data'
import type { ChangeLogRecord } from '@/lib/change-logs/types'
import { ChangeLogDetailText } from '@/components/change-logs/change-log-detail-text'
import { ERP_BADGE_COMPACT_CLASS, ERP_SECONDARY_BUTTON_CLASS, ERP_TABLE_TD_WRAP_CLASS } from '@/lib/ui/tokens'

const DEPARTMENT_LABEL = {
  production: '생산',
  material: '자재',
  sales: '영업',
} as const

const DEPARTMENT_CHIP = {
  production: 'bg-sky-50 text-sky-800 ring-sky-200',
  material: 'bg-amber-50 text-amber-800 ring-amber-200',
  sales: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
} as const

const VALUE_TONE: Record<HomeHeadlineMetric['tone'], string> = {
  default: 'text-slate-900',
  sky: 'text-sky-700',
  emerald: 'text-emerald-700',
  amber: 'text-amber-700',
  rose: 'text-rose-700',
}

function attentionToneClass(tone: HomeAttentionItem['tone']) {
  if (tone === 'danger') return 'border-l-rose-500 bg-rose-50/40'
  return 'border-l-amber-500 bg-amber-50/40'
}

function formatProductionTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function HeadlineCards({ metrics }: { metrics: HomeHeadlineMetric[] }) {
  return (
    <section className="grid shrink-0 grid-cols-2 gap-3 xl:grid-cols-4">
      {metrics.map((metric) => {
        const display =
          metric.value == null ? '–' : metric.value.toLocaleString('ko-KR')
        return (
          <Link
            key={metric.key}
            href={metric.href}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3.5 shadow-sm transition hover:border-slate-300 hover:shadow-md"
          >
            <p className="text-xs font-semibold text-slate-500">{metric.label}</p>
            <p className={`mt-1.5 text-3xl font-bold tabular-nums ${VALUE_TONE[metric.tone]}`}>
              {display}
            </p>
          </Link>
        )
      })}
    </section>
  )
}

function formatChangeTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return '—'
  return new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
}

function changeEntityLabel(entityType: ChangeLogRecord['entityType']) {
  if (entityType === 'order') return '발주서'
  if (entityType === 'item') return '품목'
  return '견적'
}

function changeEntityChip(entityType: ChangeLogRecord['entityType']) {
  if (entityType === 'order') return 'bg-sky-50 text-sky-800 ring-sky-200'
  if (entityType === 'item') return 'bg-violet-50 text-violet-800 ring-violet-200'
  return 'bg-emerald-50 text-emerald-800 ring-emerald-200'
}

function ChangesPanel({
  rows,
  status,
  message,
}: {
  rows: ChangeLogRecord[]
  status: HomeDashboardData['changeLogsStatus']
  message?: string
}) {
  const badge =
    status === 'missing_table'
      ? {
          text: '이력 테이블 미적용',
          className: 'bg-amber-50 text-amber-800 ring-amber-200',
          body: '변경사항이 기록되지 않습니다. Supabase에서 migrate-entity-change-logs.sql 을 실행하세요.',
        }
      : status === 'error' || status === 'env'
        ? {
            text: '이력 조회 실패',
            className: 'bg-rose-50 text-rose-800 ring-rose-200',
            body: message || '변경사항을 불러오지 못했습니다.',
          }
        : null

  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-slate-100 px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-base font-bold text-slate-900">변경사항</h2>
          {badge ? (
            <span
              className={`${ERP_BADGE_COMPACT_CLASS} ring-inset ${badge.className}`}
            >
              {badge.text}
            </span>
          ) : null}
        </div>
        <p className="mt-0.5 text-xs text-slate-500">발주서 · 품목 · 견적서 수정 이력</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {badge ? (
          <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-xs text-amber-900">
            {badge.body}
          </p>
        ) : null}
        {rows.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            {badge ? '이력을 표시할 수 없습니다.' : '아직 기록된 변경사항이 없습니다.'}
          </p>
        ) : (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2.5"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span
                        className={`${ERP_BADGE_COMPACT_CLASS} ring-inset ${changeEntityChip(row.entityType)}`}
                      >
                        {changeEntityLabel(row.entityType)}
                      </span>
                      <p className="text-sm font-semibold text-slate-900">{row.title}</p>
                    </div>
                    {row.detail ? <ChangeLogDetailText detail={row.detail} /> : null}
                    <p className="mt-1 text-[11px] text-slate-400">
                      {[formatChangeTime(row.changedAt), row.changedByName || null]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function AttentionPanel({ items }: { items: HomeAttentionItem[] }) {
  return (
    <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <header className="shrink-0 border-b border-slate-100 px-4 py-3">
        <h2 className="text-base font-bold text-slate-900">관심 필요</h2>
        <p className="mt-0.5 text-xs text-slate-500">바로 조치가 필요한 항목</p>
      </header>
      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
            현재 관심 필요 항목이 없습니다.
          </p>
        ) : (
          <ul className="space-y-2">
            {items.map((item) => (
              <li key={item.key}>
                <Link
                  href={item.href}
                  className={`flex items-start gap-3 rounded-xl border border-slate-200 border-l-4 px-3 py-2.5 transition hover:border-slate-300 hover:bg-slate-50/80 ${attentionToneClass(item.tone)}`}
                >
                  <span
                    className={`mt-0.5 shrink-0 ${ERP_BADGE_COMPACT_CLASS} ring-inset ${DEPARTMENT_CHIP[item.department]}`}
                  >
                    {DEPARTMENT_LABEL[item.department]}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{item.detail}</p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function TeamProductionModal({
  team,
  todayLabel,
  onClose,
}: {
  team: HomeProductionTeam | null
  todayLabel: string
  onClose: () => void
}) {
  const rows = useMemo(() => {
    if (!team) return [] as HomeTeamProductionRow[]
    return [...team.rows].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  }, [team])

  return (
    <ErpModal
      open={Boolean(team)}
      size="md"
      title={team ? `${team.team} · 오늘 생산` : '오늘 생산'}
      description={
        team
          ? `${todayLabel} · 합계 ${team.todayQuantity.toLocaleString('ko-KR')} EA · ${rows.length}건`
          : undefined
      }
      onClose={onClose}
      footer={
        team ? (
          <div className="flex items-center justify-between gap-2">
            <Link
              href={team.href}
              className={`${ERP_SECONDARY_BUTTON_CLASS} inline-flex items-center justify-center no-underline`}
            >
              생산이력 보기
            </Link>
            <button type="button" onClick={onClose} className={ERP_SECONDARY_BUTTON_CLASS}>
              닫기
            </button>
          </div>
        ) : null
      }
    >
      {!team || rows.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-slate-500">
          오늘 등록된 생산이 없습니다.
        </p>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
              <tr>
                <th className="whitespace-nowrap px-3 py-2.5">시간</th>
                <th className="whitespace-nowrap px-3 py-2.5">발주번호</th>
                <th className="whitespace-nowrap px-3 py-2.5">고객</th>
                <th className="px-3 py-2.5">품목</th>
                <th className="whitespace-nowrap px-3 py-2.5 text-right">수량</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((row) => (
                <tr key={row.id} className="bg-white">
                  <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600">
                    {formatProductionTime(row.createdAt)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 font-medium text-slate-800">
                    {row.orderNumber || '—'}
                  </td>
                  <td className={`px-3 py-2.5 text-slate-600 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                    {row.customer || '—'}
                  </td>
                  <td className="min-w-0 px-3 py-2.5 text-slate-800">
                    <p className={`font-medium ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {row.productName || '—'}
                    </p>
                    <p className={`mt-0.5 text-xs text-slate-500 ${ERP_TABLE_TD_WRAP_CLASS}`}>
                      {[row.productCode, row.detail].filter(Boolean).join(' · ') || '—'}
                    </p>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2.5 text-right font-semibold tabular-nums text-slate-900">
                    {row.quantity.toLocaleString('ko-KR')}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </ErpModal>
  )
}

function TeamProduction({
  teams,
  todayLabel,
}: {
  teams: HomeProductionTeam[]
  todayLabel: string
}) {
  const [selectedTeam, setSelectedTeam] = useState<HomeProductionTeam | null>(null)
  const total = teams.reduce((sum, team) => sum + team.todayQuantity, 0)
  const max = Math.max(...teams.map((team) => team.todayQuantity), 1)

  return (
    <>
      <aside className="flex min-h-0 w-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm xl:w-[22rem] xl:shrink-0">
        <header className="shrink-0 border-b border-slate-100 px-4 py-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-slate-900">팀별 생산</h2>
            <p className="text-xs font-bold tabular-nums text-slate-600">
              합계 {total.toLocaleString('ko-KR')} EA
            </p>
          </div>
          <p className="mt-1 text-xs font-semibold text-slate-500">{todayLabel}</p>
        </header>
        <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
          {teams.map((team) => {
            const width = total <= 0 ? 0 : Math.round((team.todayQuantity / max) * 100)
            return (
              <button
                key={team.team}
                type="button"
                onClick={() => setSelectedTeam(team)}
                className="rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-2.5 text-left transition hover:border-sky-300 hover:bg-white"
              >
                <div className="mb-1.5 flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-slate-700">{team.team}</span>
                  <span className="text-sm font-bold tabular-nums text-slate-900">
                    {team.todayQuantity.toLocaleString('ko-KR')}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-sky-500" style={{ width: `${width}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      </aside>

      <TeamProductionModal
        team={selectedTeam}
        todayLabel={todayLabel}
        onClose={() => setSelectedTeam(null)}
      />
    </>
  )
}

/** 조치 중심 홈 — 납기·자재·출하를 먼저, 생산은 보조 */
export function HomeDashboard({ data }: { data: HomeDashboardData }) {
  return (
    <div className="relative flex h-full min-h-0 w-full flex-1 flex-col gap-4 overflow-hidden">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-40 rounded-3xl bg-gradient-to-br from-slate-200/60 via-sky-100/30 to-transparent"
        aria-hidden
      />

      <HeadlineCards metrics={data.headline} />

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden xl:flex-row">
        <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3 overflow-hidden md:flex-row">
          <AttentionPanel items={data.attention} />
          <ChangesPanel
            rows={data.changeLogs}
            status={data.changeLogsStatus}
            message={data.changeLogsMessage}
          />
        </div>
        <TeamProduction teams={data.productionTeams} todayLabel={data.todayLabel} />
      </div>
    </div>
  )
}
