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

/** X축: 날짜(라벨) + 요일/구간(subLabel) 2줄 */
function DualLineXTick(props: {
  x?: number
  y?: number
  payload?: { value?: string }
  index?: number
  visibleTicksCount?: number
  rows: Record<string, string | number>[]
}) {
  const { x = 0, y = 0, payload, index = 0, rows } = props
  const row = rows[index]
  const label = String(payload?.value ?? row?.label ?? '')
  const subLabel = String(row?.subLabel ?? '').trim()

  return (
    <g transform={`translate(${x},${y})`}>
      <text textAnchor="middle" fill="#475569" fontSize={12}>
        <tspan x={0} dy="0.9em">
          {label}
        </tspan>
        {subLabel ? (
          <tspan x={0} dy="1.15em" fill="#94a3b8" fontSize={10}>
            {subLabel}
          </tspan>
        ) : null}
      </text>
    </g>
  )
}

export function ReportBarChart({ rows, series, unit, stacked = false, height = 300 }: ReportBarChartProps) {
  const hasSubLabels = rows.some((row) => String(row.subLabel || '').trim())
  // 2줄 X축(날짜+요일)이 SVG 밖으로 잘리지 않도록 여유
  const bottomMargin = hasSubLabels ? 52 : 20
  const xAxisHeight = hasSubLabels ? 52 : 28

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={rows} margin={{ top: 28, right: 16, left: 0, bottom: bottomMargin }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
        <XAxis
          dataKey="label"
          interval={0}
          tick={<DualLineXTick rows={rows} />}
          tickLine={false}
          axisLine={{ stroke: '#cbd5e1' }}
          height={xAxisHeight}
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
        <Legend
          verticalAlign="top"
          align="right"
          wrapperStyle={{ fontSize: 13, paddingBottom: 4 }}
          iconType="circle"
          iconSize={9}
        />
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
