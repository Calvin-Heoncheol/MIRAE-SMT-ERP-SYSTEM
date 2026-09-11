import { createSupabaseClient } from '@/lib/supabase'
import { addDaysYmd, todayYmdSeoul } from '@/lib/orders/utils'
import { getWeekStartMondayYmd } from '@/lib/smt/plan/utils'
import { addMonthsYmd, getMonthStartYmd } from '@/lib/production-plan/calendar'
import { POST_PROCESS_TEAMS, normalizePostProcessTeam } from '@/lib/post-process/teams'
import { SMT_REPORT_TEAM } from '@/lib/reports/production-report'

export type HomeWeekStatusItem = {
  key: string
  label: string
  value: number
  unit: string
  href: string
  tone: 'sky' | 'violet' | 'rose' | 'amber' | 'emerald' | 'slate'
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

export type HomeMonthSeriesPoint = {
  key: string
  label: string
  planned: number
  actual: number
}

export type HomeMonthCountPoint = {
  key: string
  label: string
  value: number
}

export type HomeCalendarDotTone = 'due' | 'plan' | 'ship'

export type HomeVisualAnalytics = {
  weekStatus: HomeWeekStatusItem[]
  inventory: {
    total: number
    segments: HomeInventorySegment[]
  }
  teamRanking: HomeTeamRankItem[]
  /** 납품: 출하 수량(실적). 계획은 동일 기간 출하가능 추정이 없어 0 유지 가능 */
  deliveryMonthly: HomeMonthSeriesPoint[]
  productionMonthly: HomeMonthSeriesPoint[]
  orderMonthly: HomeMonthCountPoint[]
  calendarMonthStart: string
  calendarDots: Record<string, HomeCalendarDotTone[]>
}

export type HomeVisualAnalyticsInput = {
  dueSoonOrders: number
  unshippedOrders: number
  todayShipped: number
  negativeStockMaterials: number
  positiveStockSkus: number
  expectedInboundSkus: number
  openDeliveryDates: string[]
}

function monthKey(ymd: string) {
  return ymd.slice(0, 7)
}

function monthLabel(ym: string) {
  return `${Number(ym.slice(5, 7))}월`
}

function lastSixMonthKeys(today: string) {
  const start = getMonthStartYmd(today)
  const keys: string[] = []
  for (let i = 5; i >= 0; i -= 1) {
    keys.push(monthKey(addMonthsYmd(start, -i)))
  }
  return keys
}

function emptyMonthSeries(keys: string[]): HomeMonthSeriesPoint[] {
  return keys.map((key) => ({ key, label: monthLabel(key), planned: 0, actual: 0 }))
}

function emptyMonthCounts(keys: string[]): HomeMonthCountPoint[] {
  return keys.map((key) => ({ key, label: monthLabel(key), value: 0 }))
}

type LooseRow = Record<string, unknown>

/** 동적 테이블·컬럼 조회 — Supabase 생성 타입이 템플릿 select를 거부함 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function looseFrom(table: string): any {
  return createSupabaseClient().from(table)
}

async function sumQtyByMonth(
  table: string,
  dateColumn: string,
  qtyColumn: string,
  start: string,
  end: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const { data, error } = await looseFrom(table)
      .select(`${dateColumn}, ${qtyColumn}`)
      .gte(dateColumn, start)
      .lte(dateColumn, end)
    if (error || !data) return map
    for (const row of data as LooseRow[]) {
      const date = String(row[dateColumn] || '').slice(0, 10)
      if (!date) continue
      const qty = Math.max(0, Math.floor(Number(row[qtyColumn]) || 0))
      const key = monthKey(date)
      map.set(key, (map.get(key) ?? 0) + qty)
    }
  } catch {
    /* ignore */
  }
  return map
}

async function countRowsByMonth(
  table: string,
  dateColumn: string,
  start: string,
  end: string,
): Promise<Map<string, number>> {
  const map = new Map<string, number>()
  try {
    const { data, error } = await looseFrom(table)
      .select(dateColumn)
      .gte(dateColumn, start)
      .lte(dateColumn, end)
    if (error || !data) return map
    for (const row of data as LooseRow[]) {
      const raw = String(row[dateColumn] || '')
      const date = raw.slice(0, 10)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
      const key = monthKey(date)
      map.set(key, (map.get(key) ?? 0) + 1)
    }
  } catch {
    /* ignore */
  }
  return map
}

async function sumQtyInRange(
  table: string,
  dateColumn: string,
  qtyColumn: string,
  start: string,
  end: string,
): Promise<number> {
  try {
    const { data, error } = await looseFrom(table)
      .select(qtyColumn)
      .gte(dateColumn, start)
      .lte(dateColumn, end)
    if (error || !data) return 0
    return (data as LooseRow[]).reduce(
      (sum, row) => sum + Math.max(0, Math.floor(Number(row[qtyColumn]) || 0)),
      0,
    )
  } catch {
    return 0
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

async function fetchDistinctDatesInMonth(
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
    const set = new Set<string>()
    for (const row of data as LooseRow[]) {
      const date = String(row[dateColumn] || '').slice(0, 10)
      if (/^\d{4}-\d{2}-\d{2}$/.test(date)) set.add(date)
    }
    return [...set]
  } catch {
    return []
  }
}

async function fetchMonthTeamProduction(start: string, end: string) {
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

/** 시각형 대시보드용 집계 */
export async function fetchHomeVisualAnalytics(
  input: HomeVisualAnalyticsInput,
): Promise<HomeVisualAnalytics> {
  const today = todayYmdSeoul()
  const weekStart = getWeekStartMondayYmd(today)
  const weekEnd = addDaysYmd(weekStart, 6)
  const monthStart = getMonthStartYmd(today)
  const monthKeys = lastSixMonthKeys(today)
  const seriesStart = `${monthKeys[0]}-01`

  const [
    weekInboundCount,
    weekProductionQty,
    weekDeliveryCount,
    deliveryActualByMonth,
    smtActualByMonth,
    postActualByMonth,
    smtPlanByMonth,
    postPlanByMonth,
    orderCountByMonth,
    teamMonth,
    monthPlanDates,
    monthShipDates,
  ] = await Promise.all([
    countInRange('material_inbound_records', 'inbound_date', weekStart, weekEnd),
    Promise.all([
      sumQtyInRange('smt_production_records', 'record_date', 'quantity', weekStart, weekEnd),
      sumQtyInRange('post_process_production_records', 'record_date', 'quantity', weekStart, weekEnd),
    ]).then(([a, b]) => a + b),
    countInRange('delivery_records', 'record_date', weekStart, weekEnd),
    sumQtyByMonth('delivery_records', 'record_date', 'quantity', seriesStart, today),
    sumQtyByMonth('smt_production_records', 'record_date', 'quantity', seriesStart, today),
    sumQtyByMonth('post_process_production_records', 'record_date', 'quantity', seriesStart, today),
    sumQtyByMonth('smt_production_plans', 'planned_date', 'planned_quantity', seriesStart, today),
    sumQtyByMonth(
      'post_process_production_plans',
      'planned_date',
      'planned_quantity',
      seriesStart,
      today,
    ),
    countRowsByMonth('orders', 'created_at', seriesStart, `${today}T23:59:59.999Z`),
    fetchMonthTeamProduction(monthStart, today),
    fetchDistinctDatesInMonth('smt_production_plans', 'planned_date', monthStart, today).then(
      async (smt) => [
        ...smt,
        ...(await fetchDistinctDatesInMonth(
          'post_process_production_plans',
          'planned_date',
          monthStart,
          today,
        )),
      ],
    ),
    fetchDistinctDatesInMonth('delivery_records', 'record_date', monthStart, today),
  ])

  const weekStatus: HomeWeekStatusItem[] = [
    {
      key: 'inbound',
      label: '자재 입고',
      value: weekInboundCount,
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
    },
    {
      key: 'production',
      label: '생산 실적',
      value: weekProductionQty,
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
    },
    {
      key: 'weekShip',
      label: '주간 출하',
      value: weekDeliveryCount,
      unit: '건',
      href: '/delivery/history',
      tone: 'emerald',
    },
    {
      key: 'todayShip',
      label: '오늘 출하',
      value: input.todayShipped,
      unit: '건',
      href: '/delivery/input',
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

  const teamRanking: HomeTeamRankItem[] = [...teamMonth]
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5)
    .map((row, index) => ({
      rank: index + 1,
      team: row.team,
      quantity: row.quantity,
      href: `/production/history?team=${encodeURIComponent(row.team)}`,
    }))

  const deliveryMonthly = emptyMonthSeries(monthKeys).map((point) => ({
    ...point,
    planned: 0,
    actual: deliveryActualByMonth.get(point.key) ?? 0,
  }))

  const productionMonthly = emptyMonthSeries(monthKeys).map((point) => ({
    ...point,
    planned:
      (smtPlanByMonth.get(point.key) ?? 0) + (postPlanByMonth.get(point.key) ?? 0),
    actual:
      (smtActualByMonth.get(point.key) ?? 0) + (postActualByMonth.get(point.key) ?? 0),
  }))

  const orderMonthly = emptyMonthCounts(monthKeys).map((point) => ({
    ...point,
    value: orderCountByMonth.get(point.key) ?? 0,
  }))

  const calendarDots: Record<string, HomeCalendarDotTone[]> = {}
  const addDot = (ymd: string, tone: HomeCalendarDotTone) => {
    const day = String(ymd || '').slice(0, 10)
    if (!day.startsWith(monthStart.slice(0, 7))) return
    const list = calendarDots[day] ?? []
    if (!list.includes(tone)) list.push(tone)
    calendarDots[day] = list
  }
  for (const ymd of input.openDeliveryDates) addDot(ymd, 'due')
  for (const ymd of monthPlanDates) addDot(ymd, 'plan')
  for (const ymd of monthShipDates) addDot(ymd, 'ship')

  return {
    weekStatus,
    inventory: {
      total: segments.reduce((sum, s) => sum + s.value, 0),
      segments,
    },
    teamRanking,
    deliveryMonthly,
    productionMonthly,
    orderMonthly,
    calendarMonthStart: monthStart,
    calendarDots,
  }
}
