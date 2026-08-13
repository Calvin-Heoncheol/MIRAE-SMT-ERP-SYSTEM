'use client'

import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type ReportChartSeries = {
  /** 행 객체에서 값을 읽을 키 */
  key: string
  label: string
  color: string
  /** 기본 bar. line은 추세 강조용 꺾은선 */
  type?: 'bar' | 'line'
}

type ReportBarChartProps = {
  /** label(X축) + series key 값들을 가진 행 목록 */
  rows: Record<string, string | number>[]
  series: ReportChartSeries[]
  /** 값 단위 (툴팁 표시) */
  unit: string
  /** true면 bar 시리즈를 한 막대에 누적 */
  stacked?: boolean
  height?: number
}

function formatCompactKr(value: number): string {
  if (Math.abs(value) >= 100_000_000) {
    const v = value / 100_000_000
    return `${Number.isInteger(v) ? v : v.toFixed(1)}억`
  }
  if (Math.abs(value) >= 10_000) {
    const v = value / 10_000
    return `${Number.isInteger(v) ? v : v.toFixed(1)}만`
  }
  return value.toLocaleString('ko-KR')
}

export function ReportBarChart({ rows, series, unit, stacked = false, height = 300 }: ReportBarChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={{ stroke: '#cbd5e1' }}
        />
        <YAxis
          tick={{ fontSize: 12, fill: '#64748b' }}
          tickLine={false}
          axisLine={false}
          width={56}
          tickFormatter={(value: number) => formatCompactKr(value)}
        />
        <Tooltip
          formatter={(value, name) => [`${Number(value).toLocaleString('ko-KR')} ${unit}`, name]}
          labelFormatter={(label, payload) => {
            const sub = (payload?.[0]?.payload as { subLabel?: string } | undefined)?.subLabel
            return sub ? `${label} (${sub})` : String(label)
          }}
          contentStyle={{
            borderRadius: 8,
            border: '1px solid #e2e8f0',
            fontSize: 13,
            boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)',
          }}
        />
        <Legend wrapperStyle={{ fontSize: 13 }} iconType="circle" iconSize={9} />
        {series.map((item) =>
          item.type === 'line' ? (
            <Line
              key={item.key}
              dataKey={item.key}
              name={item.label}
              stroke={item.color}
              strokeWidth={2.5}
              dot={{ r: 3, fill: item.color, strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          ) : (
            <Bar
              key={item.key}
              dataKey={item.key}
              name={item.label}
              fill={item.color}
              stackId={stacked ? 'total' : undefined}
              maxBarSize={48}
              radius={stacked ? undefined : [3, 3, 0, 0]}
            />
          ),
        )}
      </ComposedChart>
    </ResponsiveContainer>
  )
}
