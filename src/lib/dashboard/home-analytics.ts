import { createSupabaseClient } from '@/lib/supabase'
import { addDaysYmd, todayYmdSeoul } from '@/lib/orders/utils'
import { formatWeekRangeLabel, getWeekStartMondayYmd } from '@/lib/smt/plan/utils'
import { addMonthsYmd, getMonthStartYmd } from '@/lib/production-plan/calendar'
import { POST_PROCESS_TEAMS, normalizePostProcessTeam } from '@/lib/post-process/teams'
import { SMT_REPORT_TEAM } from '@/lib/reports/production-report'

export type HomeDashboardPeriod = 'day' | 'week' | 'month'

export type HomeResolvedPeriod = {
  period: HomeDashboardPeriod
  startDate: string
  endDate: string
  rangeLabel: string
  periodLabel: string
  prevDate: string
  nextDate: string
}

export type HomeStatusItem = {
  key: string
  label: string
  value: number
  unit: string
  href: string
  tone: 'sky' | 'violet' | 'rose' | 'amber' | 'emerald' | 'slate'
  /** 기간과 무관한 현재 스냅샷이면 true */
  snapshot?: boolean
}

export type HomeInventorySegment = {
  key: string
  label: string
  value: number
  color: string
}

export type HomeTeamRankItem = {
  rank: number
  team: string
  quantity: number
  href: string
}

export type HomeSeriesPoint = {
  key: string
  label: string
  planned: number
  actual: number
}

export type HomeCalendarDotTone = 'due' | 'plan' | 'ship'

export type HomeVisualAnalytics = {
  period: HomeResolvedPeriod
  status: HomeStatusItem[]
  inventory: {
    total: number
    segments: HomeInventorySegment[]
  }
  teamRanking: HomeTeamRankItem[]
  deliverySeries: HomeSeriesPoint[]
  productionSeries: HomeSeriesPoint[]
  calendarMonthStart: string
  calendarDots: Record<string, HomeCalendarDotTone[]>
}

/** @deprecated 이름 호환 */
export type HomeWeekStatusItem = HomeStatusItem
/** @deprecated */
export type HomeMonthSeriesPoint = HomeSeriesPoint

export type HomeVisualAnalyticsInput = {
  dueSoonOrders: number
  unshippedOrders: number
  negativeStockMaterials: number
  positiveStockSkus: number
  expectedInboundSkus: number
  openDeliveryDates: string[]
}

function sanitizeYmd(value: string, fallback: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : fallback
}

function monthEndYmd(monthStart: string) {
  const year = Number(monthStart.slice(0, 4))
  const month = Number(monthStart.slice(5, 7))
  const lastDay = new Date(year, month, 0).getDate()
  return `${monthStart.slice(0, 7)}-${String(lastDay).padStart(2, '0')}`
}

function monthKey(ymd: string) {
  return ymd.slice(0, 7)
}

function dayLabel(ymd: string) {
  return `${Number(ymd.slice(5, 7))}/${Number(ymd.slice(8, 10))}`
}

function monthLabelShort(ym: string) {
  return `${Number(ym.slice(5, 7))}월`
}

function weekLabelShort(weekStart: string) {
  return `${Number(weekStart.slice(5, 7))}/${Number(weekStart.slice(8, 10))}주`
}

export function resolveHomeDashboardPeriod(params: {
  period?: string | string[]
  date?: string | string[]
}): HomeResolvedPeriod {
  const rawPeriod = Array.isArray(params.period) ? params.period[0] : params.period
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date
  const today = todayYmdSeoul()
  const period: HomeDashboardPeriod =
    rawPeriod === 'day' || rawPeriod === 'month' ? rawPeriod : 'week'
  const anchor = sanitizeYmd(String(rawDate || ''), today)

  if (period === 'day') {
    return {
      period,
      startDate: anchor,
      endDate: anchor,
      rangeLabel: `${Number(anchor.slice(5, 7))}월 ${Number(anchor.slice(8, 10))}일`,
      periodLabel: '오늘',
      prevDate: addDaysYmd(anchor, -1),
      nextDate: addDaysYmd(anchor, 1),
    }
  }

  if (period === 'month') {
    const startDate = getMonthStartYmd(anchor)
    const endDate = monthEndYmd(startDate)
    return {
      period,
      startDate,
      endDate: endDate > today && startDate.slice(0, 7) === today.slice(0, 7) ? today : endDate,
      rangeLabel: `${startDate.slice(0, 4)}년 ${Number(startDate.slice(5, 7))}월`,
      periodLabel: '월간',
      prevDate: addMonthsYmd(startDate, -1),
      nextDate: addMonthsYmd(startDate, 1),
    }
  }

  const startDate = getWeekStartMondayYmd(anchor)
  const endDate = addDaysYmd(startDate, 6)
  return {
    period: 'week',
    startDate,
    endDate: endDate > today && startDate <= today ? today : endDate,
    rangeLabel: formatWeekRangeLabel(startDate),
    periodLabel: '주간',
    prevDate: addDaysYmd(startDate, -7),
    nextDate: addDaysYmd(startDate, 7),
  }
}

export function buildHomeDashboardHrefs(resolved: HomeResolvedPeriod) {
  const base = '/'
  const date = resolved.startDate
  return {
    dayHref: `${base}?period=day&date=${date}`,
    weekHref: `${base}?period=week&date=${date}`,
    monthHref: `${base}?period=month&date=${date}`,
    prevHref: `${base}?period=${resolved.period}&date=${resolved.prevDate}`,
    nextHref: `${base}?period=${resolved.period}&date=${resolved.nextDate}`,
  }
}

type SeriesBucket = { key: string; label: string; start: string; end: string }

/** 추이 차트용 버킷 — 선택 기간 단위로 최근 구간 */
function buildTrendBuckets(period: HomeDashboardPeriod, endDate: string): SeriesBucket[] {
  if (period === 'day') {
    const buckets: SeriesBucket[] = []
    for (let i = 6; i >= 0; i -= 1) {
      const day = addDaysYmd(endDate, -i)
      buckets.push({ key: day, label: dayLabel(day), start: day, end: day })
    }
    return buckets
  }

  if (period === 'week') {
    const endWeek = getWeekStartMondayYmd(endDate)
    const buckets: SeriesBucket[] = []
    for (let i = 5; i >= 0; i -= 1) {
      const start = addDaysYmd(endWeek, -i * 7)
      const end = addDaysYmd(start, 6)
      buckets.push({
        key: start,
        label: weekLabelShort(start),
        start,
        end,
      })
    }
    return buckets
  }

  const endMonth = getMonthStartYmd(endDate)
  const buckets: SeriesBucket[] = []
  for (let i = 5; i >= 0; i -= 1) {
    const start = addMonthsYmd(endMonth, -i)
    const end = monthEndYmd(start)
    buckets.push({
      key: monthKey(start),
      label: monthLabelShort(monthKey(start)),
      start,
      end,
    })
  }
  return buckets
}

function bucketKeyForDate(period: HomeDashboardPeriod, ymd: string) {
  if (period === 'day') return ymd.slice(0, 10)
  if (period === 'week') return getWeekStartMondayYmd(ymd)
  return monthKey(ymd)
}

type LooseRow = Record<string, unknown>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function looseFrom(table: string): any {
  return createSupabaseClient().from(table)
}

async function fetchQtyRows(
  table: string,
  dateColumn: string,
  qtyColumn: string,
  start: string,
  end: string,
): Promise<{ date: string; qty: number }[]> {
  try {
    const { data, error } = await looseFrom(table)
      .select(`${dateColumn}, ${qtyColumn}`)
      .gte(dateColumn, start)
      .lte(dateColumn, end)
    if (error || !data) return []
    return (data as LooseRow[])
      .map((row) => ({
        date: String(row[dateColumn] || '').slice(0, 10),
        qty: Math.max(0, Math.floor(Number(row[qtyColumn]) || 0)),
      }))
      .filter((row) => /^\d{4}-\d{2}-\d{2}$/.test(row.date))
  } catch {
    return []
  }
}

async function fetchDateRows(
  table: string,
  dateColumn: string,
  start: string,
  end: string,
): Promise<string[]> {
  try {
    const { data, error } = await looseFrom(table)
      .select(dateColumn)
      .gte(dateColumn, start)
      .lte(dateColumn, end)
    if (error || !data) return []
    return (data as LooseRow[])
      .map((row) => String(row[dateColumn] || '').slice(0, 10))
      .filter((date) => /^\d{4}-\d{2}-\d{2}$/.test(date))
  } catch {
    return []
  }
}

async function countInRange(
  table: string,
  dateColumn: string,
  start: string,
  end: string,
): Promise<number> {
  try {
    const { count, error } = await looseFrom(table)
      .select('*', { count: 'exact', head: true })
      .gte(dateColumn, start)
      .lte(dateColumn, end)
    if (error) return 0
    return typeof count === 'number' ? count : 0
  } catch {
    return 0
  }
}

async function sumQtyInRange(
  table: string,
  dateColumn: string,
  qtyColumn: string,
  start: string,
  end: string,
): Promise<number> {
  const rows = await fetchQtyRows(table, dateColumn, qtyColumn, start, end)
  return rows.reduce((sum, row) => sum + row.qty, 0)
}

function aggregateByBucket(
  period: HomeDashboardPeriod,
  buckets: SeriesBucket[],
  rows: { date: string; qty: number }[],
) {
  const map = new Map(buckets.map((b) => [b.key, 0]))
  for (const row of rows) {
    const key = bucketKeyForDate(period, row.date)
    if (!map.has(key)) continue
    map.set(key, (map.get(key) ?? 0) + row.qty)
  }
  return map
}

async function fetchTeamProduction(start: string, end: string) {
  const byTeam = new Map<string, number>()
  byTeam.set(SMT_REPORT_TEAM, 0)
  for (const team of POST_PROCESS_TEAMS) byTeam.set(team, 0)

  try {
    const supabase = createSupabaseClient()
    const [smt, post] = await Promise.all([
      supabase
        .from('smt_production_records')
        .select('quantity')
        .gte('record_date', start)
        .lte('record_date', end),
      supabase
        .from('post_process_production_records')
        .select('quantity, team')
        .gte('record_date', start)
        .lte('record_date', end),
    ])

    if (!smt.error && smt.data) {
      const qty = (smt.data as { quantity?: number }[]).reduce(
        (sum, row) => sum + Math.max(0, Math.floor(Number(row.quantity) || 0)),
        0,
      )
      byTeam.set(SMT_REPORT_TEAM, qty)
    }

    if (!post.error && post.data) {
      for (const row of post.data as { quantity?: number; team?: string }[]) {
        const team = normalizePostProcessTeam(row.team)
        const qty = Math.max(0, Math.floor(Number(row.quantity) || 0))
        byTeam.set(team, (byTeam.get(team) ?? 0) + qty)
      }
    }
  } catch {
    /* ignore */
  }

  return [...byTeam.entries()].map(([team, quantity]) => ({ team, quantity }))
}

/** 시각형 대시보드 — 선택 기간 기준으로 통일 집계 */
export async function fetchHomeVisualAnalytics(
  input: HomeVisualAnalyticsInput,
  resolved: HomeResolvedPeriod,
): Promise<HomeVisualAnalytics> {
  const { period, startDate, endDate } = resolved
  const trendBuckets = buildTrendBuckets(period, endDate)
  const trendStart = trendBuckets[0]?.start ?? startDate
  const calendarMonthStart = getMonthStartYmd(endDate)
  const calendarMonthEnd = monthEndYmd(calendarMonthStart)

  const [
    inboundCount,
    productionQty,
    deliveryCount,
    orderCount,
    deliveryRows,
    smtActualRows,
    postActualRows,
    smtPlanRows,
    postPlanRows,
    teamRows,
    planDates,
    shipDates,
  ] = await Promise.all([
    countInRange('material_inbound_records', 'inbound_date', startDate, endDate),
    Promise.all([
      sumQtyInRange('smt_production_records', 'record_date', 'quantity', startDate, endDate),
      sumQtyInRange('post_process_production_records', 'record_date', 'quantity', startDate, endDate),
    ]).then(([a, b]) => a + b),
    countInRange('delivery_records', 'record_date', startDate, endDate),
    countInRange('orders', 'created_at', startDate, `${endDate}T23:59:59.999Z`),
    fetchQtyRows('delivery_records', 'record_date', 'quantity', trendStart, endDate),
    fetchQtyRows('smt_production_records', 'record_date', 'quantity', trendStart, endDate),
    fetchQtyRows('post_process_production_records', 'record_date', 'quantity', trendStart, endDate),
    fetchQtyRows('smt_production_plans', 'planned_date', 'planned_quantity', trendStart, endDate),
    fetchQtyRows(
      'post_process_production_plans',
      'planned_date',
      'planned_quantity',
      trendStart,
      endDate,
    ),
    fetchTeamProduction(startDate, endDate),
    Promise.all([
      fetchDateRows('smt_production_plans', 'planned_date', calendarMonthStart, calendarMonthEnd),
      fetchDateRows(
        'post_process_production_plans',
        'planned_date',
        calendarMonthStart,
        calendarMonthEnd,
      ),
    ]).then(([a, b]) => [...a, ...b]),
    fetchDateRows('delivery_records', 'record_date', calendarMonthStart, calendarMonthEnd),
  ])

  const status: HomeStatusItem[] = [
    {
      key: 'inbound',
      label: '자재 입고',
      value: inboundCount,
      unit: '건',
      href: '/materials/inbound',
      tone: 'sky',
    },
    {
      key: 'unshipped',
      label: '미출하 발주',
      value: input.unshippedOrders,
      unit: '건',
      href: '/production/status',
      tone: 'violet',
      snapshot: true,
    },
    {
      key: 'production',
      label: '생산 실적',
      value: productionQty,
      unit: 'EA',
      href: '/production/performance',
      tone: 'rose',
    },
    {
      key: 'due',
      label: '납기 위험',
      value: input.dueSoonOrders,
      unit: '건',
      href: '/production/status',
      tone: 'amber',
      snapshot: true,
    },
    {
      key: 'delivery',
      label: '출하',
      value: deliveryCount,
      unit: '건',
      href: '/delivery/history',
      tone: 'emerald',
    },
    {
      key: 'orders',
      label: '수주',
      value: orderCount,
      unit: '건',
      href: '/orders',
      tone: 'slate',
    },
  ]

  const segments: HomeInventorySegment[] = [
    {
      key: 'ok',
      label: '정상 재고',
      value: Math.max(0, input.positiveStockSkus),
      color: '#38bdf8',
    },
    {
      key: 'pending',
      label: '입고 예정',
      value: Math.max(0, input.expectedInboundSkus),
      color: '#818cf8',
    },
    {
      key: 'neg',
      label: '마이너스',
      value: Math.max(0, input.negativeStockMaterials),
      color: '#f43f5e',
    },
  ]

  const teamRanking: HomeTeamRankItem[] = [...teamRows]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map((row, index) => ({
      rank: index + 1,
      team: row.team,
      quantity: row.quantity,
      href: `/production/history?team=${encodeURIComponent(row.team)}`,
    }))

  const deliveryByBucket = aggregateByBucket(period, trendBuckets, deliveryRows)
  const smtActualByBucket = aggregateByBucket(period, trendBuckets, smtActualRows)
  const postActualByBucket = aggregateByBucket(period, trendBuckets, postActualRows)
  const smtPlanByBucket = aggregateByBucket(period, trendBuckets, smtPlanRows)
  const postPlanByBucket = aggregateByBucket(period, trendBuckets, postPlanRows)

  const deliverySeries: HomeSeriesPoint[] = trendBuckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    planned: 0,
    actual: deliveryByBucket.get(bucket.key) ?? 0,
  }))

  const productionSeries: HomeSeriesPoint[] = trendBuckets.map((bucket) => ({
    key: bucket.key,
    label: bucket.label,
    planned:
      (smtPlanByBucket.get(bucket.key) ?? 0) + (postPlanByBucket.get(bucket.key) ?? 0),
    actual:
      (smtActualByBucket.get(bucket.key) ?? 0) + (postActualByBucket.get(bucket.key) ?? 0),
  }))

  const calendarDots: Record<string, HomeCalendarDotTone[]> = {}
  const addDot = (ymd: string, tone: HomeCalendarDotTone) => {
    const day = String(ymd || '').slice(0, 10)
    if (!day.startsWith(calendarMonthStart.slice(0, 7))) return
    const list = calendarDots[day] ?? []
    if (!list.includes(tone)) list.push(tone)
    calendarDots[day] = list
  }
  for (const ymd of input.openDeliveryDates) addDot(ymd, 'due')
  for (const ymd of planDates) addDot(ymd, 'plan')
  for (const ymd of shipDates) addDot(ymd, 'ship')

  return {
    period: resolved,
    status,
    inventory: {
      total: segments.reduce((sum, s) => sum + s.value, 0),
      segments,
    },
    teamRanking,
    deliverySeries,
    productionSeries,
    calendarMonthStart,
    calendarDots,
  }
}
