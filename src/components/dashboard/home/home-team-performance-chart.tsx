'use client'

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { HomeProductionTeam } from '@/lib/dashboard/home-data'

const TEAM_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'] as const

type HomeTeamPerformanceChartProps = {
  teams: HomeProductionTeam[]
}

export function HomeTeamPerformanceChart({ teams }: HomeTeamPerformanceChartProps) {
  const rows = teams.map((team, index) => ({
    label: team.team.replace(/^생산/, ''),
    fullLabel: team.team,
    value: team.todayQuantity,
    color: TEAM_COLORS[index % TEAM_COLORS.length],
  }))
  const total = rows.reduce((sum, row) => sum + row.value, 0)

  if (total <= 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/80 px-3 py-6 text-center text-xs font-medium text-slate-500">
        오늘 등록된 생산실적이 없습니다
      </div>
    )
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1.5">
      <div className="min-h-[140px] flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 18, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 11, fill: '#64748b', fontWeight: 600 }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              width={44}
              tickFormatter={(value: number) => value.toLocaleString('ko-KR')}
            />
            <Tooltip
              formatter={(value) => [`${Number(value).toLocaleString('ko-KR')} EA`, '생산량']}
              labelFormatter={(_, payload) => {
                const full = (payload?.[0]?.payload as { fullLabel?: string } | undefined)?.fullLabel
                return full ?? ''
              }}
              contentStyle={{
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                fontSize: 12,
                boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
              }}
            />
            <Bar dataKey="value" maxBarSize={44} radius={[4, 4, 0, 0]}>
              {rows.map((row) => (
                <Cell key={row.fullLabel} fill={row.color} />
              ))}
              <LabelList
                dataKey="value"
                position="top"
                formatter={(value) => Number(value).toLocaleString('ko-KR')}
                style={{ fontSize: 11, fontWeight: 700, fill: '#0f172a' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="shrink-0 text-center text-[11px] font-medium text-slate-500">
        합계{' '}
        <span className="font-bold tabular-nums text-slate-800">
          {total.toLocaleString('ko-KR')}
        </span>{' '}
        EA
      </p>
    </div>
  )
}
