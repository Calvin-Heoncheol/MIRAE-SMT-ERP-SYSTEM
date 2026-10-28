import { addDaysYmd, displayOrderPoNumber, todayYmdSeoul } from '@/lib/orders/utils'
import { buildPostProcessPlanProgressKey } from '@/lib/post-process/count-keys'
import { fetchAllPostProcessProductionPlans } from '@/lib/post-process/plan/repository'
import { POST_PROCESS_TEAMS } from '@/lib/post-process/teams'
import { splitPlanQuantityByWorkday } from '@/lib/production-plan/calendar'
import { fetchProductionPlanBoard } from '@/lib/production-plan/repository'
import { isProductionPlanScheduleRow } from '@/lib/production-plan/utils'
import { fetchProductionStatusPageData } from '@/lib/production-status/repository'
import { buildSmtPlanProgressKey } from '@/lib/smt/count-keys'
import { fetchAllSmtProductionPlans } from '@/lib/smt/plan/repository'
import { daysUntilYmd } from '@/lib/smt/plan/utils'
import type { SmtPcbSide } from '@/lib/smt/types'
import { createSupabaseClient } from '@/lib/supabase'

export const SMT_REPORT_TEAM = '생산1팀'

/** 리포트 표시 순서: 생산1(SMT) → 생산2/3/4(후공정) */
export const PRODUCTION_REPORT_TEAMS: string[] = [SMT_REPORT_TEAM, ...POST_PROCESS_TEAMS]

export type ProductionReportTeamSummary = {
  team: string
  /** 기간 내 생산수량 합 */
  quantity: number
  /** 기간 내 생산금액 합 (수량 × 공정 단가: SMT=SMD 단가, 후공정=DIP 단가) */
  amount: number
  /** 생산 기록이 있는 날 수 */
  activeDays: number
  /** 납기 경과 + 미출하 발주 중 이 팀 잔량이 남은 건수 */
  overdueOrders: number
  /** 기간 내 원계획 수량 (지난 날짜 · 생산계획에 배정된 계획만) */
  plannedQuantity: number
  /** 계획 달성률 % (지난 날짜 · 계획배정 대비 계획탭 실적). 계획이 없으면 null */
  achievementRate: number | null
}

export type ProductionReportDetailRow = {
  recordDate: string
  team: string
  orderNumber: string
  customer: string
  productName: string
  quantity: number
  /** 공정 단가 (SMT=SMD 단가, 후공정=구성 반제품 DIP 단가 합) */
  unitPrice: number
  amount: number
}

export type ProductionReportDailyRow = {
  date: string
  /** 일자별 팀 실적 */
  byTeam: Record<string, number>
  /** 일자별 팀 계획 (기간 내 전체 날짜, 미래 포함) */
  plannedByTeam: Record<string, number>
  total: number
  plannedTotal: number
  /** 생산1팀(SMT) 라인별 실적 — key: 라인 번호 */
  smtByLine: Record<number, number>
  /** 생산1팀(SMT) 라인별 계획 — key: 라인 번호 */
  smtPlannedByLine: Record<number, number>
}

/** 라인(SMT)·팀(후공정) 아래 발주별 계획/실적 */
export type ProductionReportOrderRow = {
  /** 'line-{n}' (SMT) 또는 팀 이름 (후공정) — 화면 매트릭스 그룹 key와 동일 */
  groupKey: string
  key: string
  customer: string
  orderLabel: string
  productName: string
  targetQuantity: number
  /** 공정 단가 (SMT=SMD 단가, 후공정=DIP 세트 단가) — 실적 금액 = 실적 수량 × 단가 */
  unitPrice: number
  plannedByDate: Record<string, number>
  actualByDate: Record<string, number>
}

export type ProductionReportData = {
  startDate: string
  endDate: string
  /** 기간 내 계획 또는 실적이 있는 SMT 라인 번호 (오름차순) */
  smtLines: number[]
  orderRows: ProductionReportOrderRow[]
  teams: ProductionReportTeamSummary[]
  daily: ProductionReportDailyRow[]
  details: ProductionReportDetailRow[]
  totalQuantity: number
  totalAmount: number
  /** 납기 경과했는데 출하 미완료인 주문 수 (회사 전체) */
  totalOverdueOrders: number
  /** 기간 내 원계획 수량 합 (지난 날짜 · 생산계획 배정분만) */
  totalPlannedQuantity: number
  /** 전체 계획 달성률 % (지난 날짜 · 계획배정 대비 계획탭 실적). 계획이 없으면 null */
  totalAchievementRate: number | null
}

export type FetchProductionReportResult =
  | { ok: true; data: ProductionReportData }
  | { ok: false; reason: 'env' | 'query'; detail: string }

type SmtRecordRow = {
  record_date: string
  order_line_id: string | null
  line_no: number | null
  pcb_side: string | null
  quantity: number
}

type PostRecordRow = {
  record_date: string
  assembly_group_id: string | null
  team?: string | null
  quantity: number
}

type OrderLineInfo = {
  orderId: string
  customer: string
  productId: string
  productName: string
}

type AssemblyGroupInfo = {
  orderId: string
  customer: string
  parentProductId: string
  productName: string
}

type GroupChildLine = {
  childProductId: string
  quantityPer: number
}

/** 반제품 공정 단가 (items.smd_unit_price / dip_unit_price) */
type ItemProcessPrice = {
  smd: number
  dip: number
}

const IN_CHUNK_SIZE = 150

function chunk<T>(values: T[], size: number): T[][] {
  const result: T[][] = []
  for (let index = 0; index < values.length; index += size) {
    result.push(values.slice(index, index + size))
  }
  return result
}

function normalizeTeam(value: string | null | undefined): string {
  const trimmed = String(value ?? '').trim()
  return trimmed || POST_PROCESS_TEAMS[0]
}

function missingEnvResult(): FetchProductionReportResult {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 환경변수가 필요합니다.',
  }
}

export async function fetchProductionReportData(
  startDate: string,
  endDate: string,
): Promise<FetchProductionReportResult> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    return missingEnvResult()
  }

  try {
    const supabase = createSupabaseClient()

    // ── 1. 기간 내 생산 기록 + 생산계획 배정 ─────────────────────
    // 계획/실적 모두 「생산계획 보드에 보이는 배정」만 인정.
    // (출하완료·잔량0 등으로 보드에서 빠진 고아 계획은 실적 집계에서 제외)
    const [smtRecordsResult, postRecordsResult, smtPlansResult, postPlansResult, boardResult] =
      await Promise.all([
        supabase
          .from('smt_production_records')
          .select('record_date, order_line_id, line_no, pcb_side, quantity')
          .gte('record_date', startDate)
          .lte('record_date', endDate),
        supabase
          .from('post_process_production_records')
          .select('record_date, assembly_group_id, team, quantity')
          .gte('record_date', startDate)
          .lte('record_date', endDate),
        fetchAllSmtProductionPlans(),
        fetchAllPostProcessProductionPlans(),
        fetchProductionPlanBoard(),
      ])

    if (smtRecordsResult.error) {
      return { ok: false, reason: 'query', detail: smtRecordsResult.error.message }
    }

    if (!smtPlansResult.ok) {
      return { ok: false, reason: smtPlansResult.reason, detail: smtPlansResult.detail }
    }
    if (!postPlansResult.ok) {
      return { ok: false, reason: postPlansResult.reason, detail: postPlansResult.detail }
    }
    if (!boardResult.ok) {
      return { ok: false, reason: boardResult.reason, detail: boardResult.detail }
    }

    const visibleSmtPlanIds = new Set<string>()
    const visiblePostPlanIds = new Set<string>()
    for (const row of boardResult.data.rows) {
      if (!isProductionPlanScheduleRow(row)) continue
      const planId = String(row.planId || '').trim()
      if (!planId) continue
      if (row.scope === 'smt') visibleSmtPlanIds.add(planId)
      if (row.scope === 'post') visiblePostPlanIds.add(planId)
    }

    let postRows: PostRecordRow[] = []
    if (postRecordsResult.error) {
      // 레거시 스키마(team 컬럼 없음) 폴백
      if (postRecordsResult.error.message.includes('team')) {
        const legacy = await supabase
          .from('post_process_production_records')
          .select('record_date, assembly_group_id, quantity')
          .gte('record_date', startDate)
          .lte('record_date', endDate)
        if (legacy.error) {
          return { ok: false, reason: 'query', detail: legacy.error.message }
        }
        postRows = (legacy.data || []) as PostRecordRow[]
      } else {
        return { ok: false, reason: 'query', detail: postRecordsResult.error.message }
      }
    } else {
      postRows = (postRecordsResult.data || []) as PostRecordRow[]
    }

    // 기간 계획은 평일 하루 단위로 쪼개서 집계 (실적도 기간 내 날짜면 모두 인정)
    function expandToDailyPlans<T extends { plannedDate: string; plannedEndDate: string; plannedQuantity: number }>(
      plans: T[],
    ): T[] {
      return plans.flatMap((plan) =>
        splitPlanQuantityByWorkday(plan.plannedDate, plan.plannedEndDate, plan.plannedQuantity)
          .filter((day) => day.date >= startDate && day.date <= endDate)
          .map((day) => ({ ...plan, plannedDate: day.date, plannedEndDate: day.date, plannedQuantity: day.quantity })),
      )
    }

    const smtPlansInRange = expandToDailyPlans(
      smtPlansResult.plans.filter((plan) => visibleSmtPlanIds.has(plan.id)),
    )
    const postPlansInRange = expandToDailyPlans(
      postPlansResult.plans.filter((plan) => visiblePostPlanIds.has(plan.id)),
    )

    /** SMT: 생산계획에 배정된 (일자·발주라인·면·라인) 키 */
    const smtPlanKeys = new Set<string>()
    for (const plan of smtPlansInRange) {
      const lineNo = Math.floor(Number(plan.lineNo) || 0)
      if (lineNo < 1) continue
      smtPlanKeys.add(
        buildSmtPlanProgressKey(
          plan.orderLineId,
          plan.pcbSide,
          lineNo,
          plan.plannedDate,
        ),
      )
    }

    /** 후공정: 생산계획에 배정된 (일자·조립그룹·팀) 키 */
    const postPlanKeys = new Set<string>()
    for (const plan of postPlansInRange) {
      postPlanKeys.add(
        buildPostProcessPlanProgressKey(plan.assemblyGroupId, plan.plannedDate, plan.team),
      )
    }

    const smtRows = ((smtRecordsResult.data || []) as SmtRecordRow[]).filter((row) => {
      const orderLineId = String(row.order_line_id || '').trim()
      const lineNo = Math.floor(Number(row.line_no) || 0)
      const pcbSide = String(row.pcb_side || '').trim() as SmtPcbSide
      const recordDate = String(row.record_date || '').trim()
      if (!orderLineId || lineNo < 1 || !pcbSide || !recordDate) return false
      return smtPlanKeys.has(buildSmtPlanProgressKey(orderLineId, pcbSide, lineNo, recordDate))
    })

    postRows = postRows.filter((row) => {
      const groupId = String(row.assembly_group_id || '').trim()
      const recordDate = String(row.record_date || '').trim()
      const team = normalizeTeam(row.team)
      if (!groupId || !recordDate) return false
      return postPlanKeys.has(buildPostProcessPlanProgressKey(groupId, recordDate, team))
    })

    // ── 2. SMT 기록 → 주문라인 정보 (제품·고객사) ────────────────
    const smtLineIds = [...new Set(smtRows.map((row) => row.order_line_id).filter(Boolean))] as string[]
    const orderLineInfoById = new Map<string, OrderLineInfo>()

    for (const ids of chunk(smtLineIds, IN_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('order_lines')
        .select('id, order_id, product_id, product_code, product_name, orders(customer)')
        .in('id', ids)
      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }
      for (const row of data || []) {
        const orders = row.orders as { customer?: string | null } | { customer?: string | null }[] | null
        const customer = Array.isArray(orders) ? orders[0]?.customer : orders?.customer
        orderLineInfoById.set(String(row.id), {
          orderId: String(row.order_id ?? ''),
          customer: String(customer ?? '').trim(),
          productId:
            String(row.product_id ?? '').trim() || String(row.product_code ?? '').trim(),
          productName: String(row.product_name ?? '').trim(),
        })
      }
    }

    // ── 3. 후공정 기록 → 조립그룹 + 구성 반제품 ─────────────────
    const groupIds = [...new Set(postRows.map((row) => row.assembly_group_id).filter(Boolean))] as string[]
    const groupInfoById = new Map<string, AssemblyGroupInfo>()
    const groupLinesByGroupId = new Map<string, GroupChildLine[]>()

    for (const ids of chunk(groupIds, IN_CHUNK_SIZE)) {
      const [groupsResult, linesResult] = await Promise.all([
        supabase
          .from('order_assembly_groups')
          .select(
            'id, order_id, parent_product_id, items!order_assembly_groups_parent_product_id_fkey(name), orders(customer)',
          )
          .in('id', ids),
        supabase
          .from('order_assembly_group_lines')
          .select('assembly_group_id, child_product_id, quantity_per')
          .in('assembly_group_id', ids),
      ])

      if (groupsResult.error) {
        return { ok: false, reason: 'query', detail: groupsResult.error.message }
      }
      if (linesResult.error) {
        return { ok: false, reason: 'query', detail: linesResult.error.message }
      }

      for (const row of groupsResult.data || []) {
        const items = row.items as { name?: string | null } | { name?: string | null }[] | null
        const item = Array.isArray(items) ? items[0] : items
        const orders = row.orders as { customer?: string | null } | { customer?: string | null }[] | null
        const customer = Array.isArray(orders) ? orders[0]?.customer : orders?.customer
        groupInfoById.set(String(row.id), {
          orderId: String(row.order_id ?? ''),
          customer: String(customer ?? '').trim(),
          parentProductId: String(row.parent_product_id ?? '').trim(),
          productName: String(item?.name ?? '').trim() || String(row.parent_product_id ?? ''),
        })
      }

      for (const row of linesResult.data || []) {
        const groupId = String(row.assembly_group_id ?? '')
        const list = groupLinesByGroupId.get(groupId) ?? []
        list.push({
          childProductId: String(row.child_product_id ?? '').trim(),
          quantityPer: Math.max(1, Math.floor(Number(row.quantity_per) || 1)),
        })
        groupLinesByGroupId.set(groupId, list)
      }
    }

    // ── 4. 품목 공정 단가 (SMD/DIP) ────────────────────────────
    const productIds = new Set<string>()
    for (const info of orderLineInfoById.values()) {
      if (info.productId) productIds.add(info.productId)
    }
    for (const info of groupInfoById.values()) {
      if (info.parentProductId) productIds.add(info.parentProductId)
    }
    for (const lines of groupLinesByGroupId.values()) {
      for (const line of lines) {
        if (line.childProductId) productIds.add(line.childProductId)
      }
    }

    const priceByProductId = new Map<string, ItemProcessPrice>()

    for (const ids of chunk([...productIds], IN_CHUNK_SIZE)) {
      const { data, error } = await supabase
        .from('items')
        .select('id, item_category, process_type, unit_price, smd_unit_price, dip_unit_price, material_unit_price')
        .in('id', ids)
      if (error) {
        return { ok: false, reason: 'query', detail: error.message }
      }
      for (const row of data || []) {
        const isSemi = Number(row.item_category) === 3
        const unitPrice = Math.max(0, Number(row.unit_price) || 0)
        const smd = Math.max(0, Number(row.smd_unit_price) || 0)
        const dip = Math.max(0, Number(row.dip_unit_price) || 0)
        const material = Math.max(0, Number(row.material_unit_price) || 0)
        const hasBreakdown = smd > 0 || dip > 0 || material > 0

        // 마이그레이션 전 데이터: 세부 단가가 없으면 합계를 공정에 따라 배분 (items/utils와 동일 규칙)
        const resolvedSmd =
          isSemi && !hasBreakdown && unitPrice > 0
            ? row.process_type === 'post'
              ? 0
              : unitPrice
            : smd
        const resolvedDip =
          isSemi && !hasBreakdown && unitPrice > 0
            ? row.process_type === 'post'
              ? unitPrice
              : 0
            : dip

        priceByProductId.set(String(row.id), {
          smd: isSemi ? Math.round(resolvedSmd) : 0,
          dip: isSemi ? Math.round(resolvedDip) : 0,
        })
      }
    }

    /** 후공정 1세트 단가 = 구성 반제품들의 DIP 단가 × 소요수량 합. 구성 정보 없으면 그룹 조립제품 자체의 DIP 단가 */
    function resolvePostSetPrice(groupId: string, info: AssemblyGroupInfo): number {
      const lines = groupLinesByGroupId.get(groupId)
      if (lines?.length) {
        return lines.reduce(
          (sum, line) =>
            sum + line.quantityPer * (priceByProductId.get(line.childProductId)?.dip ?? 0),
          0,
        )
      }
      return priceByProductId.get(info.parentProductId)?.dip ?? 0
    }

    // ── 5. 상세 행 구성 ─────────────────────────────────────────
    const details: ProductionReportDetailRow[] = []

    for (const row of smtRows) {
      const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0))
      if (quantity <= 0) continue
      const info = row.order_line_id ? orderLineInfoById.get(String(row.order_line_id)) : undefined
      const unitPrice = info ? (priceByProductId.get(info.productId)?.smd ?? 0) : 0
      details.push({
        recordDate: String(row.record_date ?? ''),
        team: SMT_REPORT_TEAM,
        orderNumber: info?.orderId ?? '',
        customer: info?.customer ?? '',
        productName: info?.productName ?? '',
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
      })
    }

    for (const row of postRows) {
      const quantity = Math.max(0, Math.floor(Number(row.quantity) || 0))
      if (quantity <= 0) continue
      const groupId = String(row.assembly_group_id ?? '')
      const info = groupId ? groupInfoById.get(groupId) : undefined
      const unitPrice = info ? resolvePostSetPrice(groupId, info) : 0
      details.push({
        recordDate: String(row.record_date ?? ''),
        team: normalizeTeam(row.team),
        orderNumber: info?.orderId ?? '',
        customer: info?.customer ?? '',
        productName: info?.productName ?? '',
        quantity,
        unitPrice,
        amount: quantity * unitPrice,
      })
    }

    const teamOrder = new Map(PRODUCTION_REPORT_TEAMS.map((team, index) => [team, index]))
    details.sort((a, b) => {
      if (a.recordDate !== b.recordDate) return a.recordDate.localeCompare(b.recordDate)
      return (teamOrder.get(a.team) ?? 99) - (teamOrder.get(b.team) ?? 99)
    })

    // ── 6. 납기 지연 (팀별 잔량 귀속) ───────────────────────────
    const today = todayYmdSeoul()
    let totalOverdueOrders = 0
    const overdueByTeam = new Map<string, number>(PRODUCTION_REPORT_TEAMS.map((team) => [team, 0]))

    const statusResult = await fetchProductionStatusPageData()

    if (statusResult.ok) {
      const plansByOrderId = new Map<string, Set<string>>()
      for (const plan of postPlansInRange) {
        const teams = plansByOrderId.get(plan.orderId) ?? new Set<string>()
        teams.add(normalizeTeam(plan.team))
        plansByOrderId.set(plan.orderId, teams)
      }

      for (const line of statusResult.data.lines) {
        if (!line.deliveryDate) continue
        const daysUntil = daysUntilYmd(today, line.deliveryDate)
        if (daysUntil == null || daysUntil >= 0) continue
        const shipped = line.deliveryTarget > 0 && line.deliveryProduced >= line.deliveryTarget
        if (shipped) continue

        totalOverdueOrders += 1

        if (line.smtTarget > line.smtProduced) {
          overdueByTeam.set(SMT_REPORT_TEAM, (overdueByTeam.get(SMT_REPORT_TEAM) ?? 0) + 1)
        }

        if (line.postTarget > line.postProduced) {
          const plannedTeams = plansByOrderId.get(line.orderId)
          for (const team of plannedTeams ?? []) {
            overdueByTeam.set(team, (overdueByTeam.get(team) ?? 0) + 1)
          }
        }
      }
    }

    // ── 7. 계획 수량 (생산계획 페이지에 배정된 행만 · 마감로그 복원 없음) ──
    const plannedByTeam = new Map<string, number>(PRODUCTION_REPORT_TEAMS.map((team) => [team, 0]))
    const producedPastByTeam = new Map<string, number>(
      PRODUCTION_REPORT_TEAMS.map((team) => [team, 0]),
    )
    const dailyPlannedByDate = new Map<string, Record<string, number>>()

    function addPlanned(team: string, quantity: number) {
      plannedByTeam.set(team, (plannedByTeam.get(team) ?? 0) + Math.max(0, quantity))
    }

    function addDailyPlanned(date: string, team: string, quantity: number) {
      const qty = Math.max(0, Math.floor(Number(quantity) || 0))
      if (qty <= 0 || date < startDate || date > endDate) return
      const byTeam = dailyPlannedByDate.get(date) ?? {}
      byTeam[team] = (byTeam[team] ?? 0) + qty
      dailyPlannedByDate.set(date, byTeam)
    }

    const smtLineSet = new Set<number>()
    const dailySmtPlannedByLine = new Map<string, Record<number, number>>()
    const dailySmtActualByLine = new Map<string, Record<number, number>>()

    function addSmtLine(
      target: Map<string, Record<number, number>>,
      date: string,
      lineNo: number,
      quantity: number,
    ) {
      const qty = Math.max(0, Math.floor(Number(quantity) || 0))
      if (qty <= 0 || lineNo < 1 || date < startDate || date > endDate) return
      smtLineSet.add(lineNo)
      const byLine = target.get(date) ?? {}
      byLine[lineNo] = (byLine[lineNo] ?? 0) + qty
      target.set(date, byLine)
    }

    for (const row of smtRows) {
      addSmtLine(
        dailySmtActualByLine,
        String(row.record_date || '').trim(),
        Math.floor(Number(row.line_no) || 0),
        row.quantity,
      )
    }

    for (const plan of smtPlansInRange) {
      addSmtLine(
        dailySmtPlannedByLine,
        plan.plannedDate,
        Math.floor(Number(plan.lineNo) || 0),
        plan.plannedQuantity,
      )
      addDailyPlanned(plan.plannedDate, SMT_REPORT_TEAM, plan.plannedQuantity)
      if (plan.plannedDate >= today) continue
      addPlanned(SMT_REPORT_TEAM, plan.plannedQuantity)
    }
    for (const plan of postPlansInRange) {
      const team = normalizeTeam(plan.team)
      addDailyPlanned(plan.plannedDate, team, plan.plannedQuantity)
      if (plan.plannedDate >= today) continue
      addPlanned(team, plan.plannedQuantity)
    }

    // ── 8. 팀별 요약 + 일별 매트릭스 ────────────────────────────
    const quantityByTeam = new Map<string, number>()
    const amountByTeam = new Map<string, number>()
    const activeDatesByTeam = new Map<string, Set<string>>()
    const dailyByDate = new Map<string, Record<string, number>>()

    for (const detail of details) {
      quantityByTeam.set(detail.team, (quantityByTeam.get(detail.team) ?? 0) + detail.quantity)
      amountByTeam.set(detail.team, (amountByTeam.get(detail.team) ?? 0) + detail.amount)
      const dates = activeDatesByTeam.get(detail.team) ?? new Set<string>()
      dates.add(detail.recordDate)
      activeDatesByTeam.set(detail.team, dates)

      const byTeam = dailyByDate.get(detail.recordDate) ?? {}
      byTeam[detail.team] = (byTeam[detail.team] ?? 0) + detail.quantity
      dailyByDate.set(detail.recordDate, byTeam)

      // 달성률 분자: 계획과 같은 기준(지난 날짜)의 실적만 집계
      if (detail.recordDate < today) {
        producedPastByTeam.set(
          detail.team,
          (producedPastByTeam.get(detail.team) ?? 0) + detail.quantity,
        )
      }
    }

    function achievementRate(planned: number, produced: number): number | null {
      if (planned <= 0) return null
      return Math.round((produced / planned) * 100)
    }

    const teams: ProductionReportTeamSummary[] = PRODUCTION_REPORT_TEAMS.map((team) => {
      const plannedQuantity = plannedByTeam.get(team) ?? 0
      return {
        team,
        quantity: quantityByTeam.get(team) ?? 0,
        amount: amountByTeam.get(team) ?? 0,
        activeDays: activeDatesByTeam.get(team)?.size ?? 0,
        overdueOrders: overdueByTeam.get(team) ?? 0,
        plannedQuantity,
        achievementRate: achievementRate(plannedQuantity, producedPastByTeam.get(team) ?? 0),
      }
    })

    // ── 9. 라인·팀별 발주 행 ───────────────────────────────────
    const boardInfo = new Map<string, (typeof boardResult.data.rows)[number]>()
    for (const row of boardResult.data.rows) {
      const key = `${row.scope}:${row.targetId}`
      if (!boardInfo.has(key)) boardInfo.set(key, row)
    }

    const orderRowMap = new Map<string, ProductionReportOrderRow>()
    function orderRowFor(groupKey: string, scope: 'smt' | 'post', targetId: string) {
      const key = `${groupKey}|${targetId}`
      let entry = orderRowMap.get(key)
      if (!entry) {
        const info = boardInfo.get(`${scope}:${targetId}`)
        const lineInfo = scope === 'smt' ? orderLineInfoById.get(targetId) : undefined
        const groupInfo = scope === 'post' ? groupInfoById.get(targetId) : undefined
        entry = {
          groupKey,
          key,
          customer: info?.customer || lineInfo?.customer || groupInfo?.customer || '',
          orderLabel:
            displayOrderPoNumber(info?.customerPoNumber, info?.orderNumber) ||
            info?.orderNumber ||
            lineInfo?.orderId ||
            groupInfo?.orderId ||
            '',
          productName: info?.productName || lineInfo?.productName || groupInfo?.productName || '',
          targetQuantity: Math.max(0, Math.round(info?.orderQty ?? 0)),
          unitPrice:
            scope === 'smt'
              ? lineInfo
                ? (priceByProductId.get(lineInfo.productId)?.smd ?? 0)
                : 0
              : groupInfo
                ? resolvePostSetPrice(targetId, groupInfo)
                : 0,
          plannedByDate: {},
          actualByDate: {},
        }
        orderRowMap.set(key, entry)
      }
      return entry
    }
    function addTo(target: Record<string, number>, date: string, quantity: number) {
      const qty = Math.max(0, Math.floor(Number(quantity) || 0))
      if (qty <= 0 || date < startDate || date > endDate) return
      target[date] = (target[date] ?? 0) + qty
    }

    for (const plan of smtPlansInRange) {
      const lineNo = Math.floor(Number(plan.lineNo) || 0)
      if (lineNo < 1 || !plan.orderLineId) continue
      addTo(orderRowFor(`line-${lineNo}`, 'smt', plan.orderLineId).plannedByDate, plan.plannedDate, plan.plannedQuantity)
    }
    for (const row of smtRows) {
      const lineNo = Math.floor(Number(row.line_no) || 0)
      const lineId = String(row.order_line_id || '').trim()
      if (lineNo < 1 || !lineId) continue
      addTo(orderRowFor(`line-${lineNo}`, 'smt', lineId).actualByDate, String(row.record_date || ''), row.quantity)
    }
    for (const plan of postPlansInRange) {
      if (!plan.assemblyGroupId) continue
      addTo(
        orderRowFor(normalizeTeam(plan.team), 'post', plan.assemblyGroupId).plannedByDate,
        plan.plannedDate,
        plan.plannedQuantity,
      )
    }
    for (const row of postRows) {
      const groupId = String(row.assembly_group_id || '').trim()
      if (!groupId) continue
      addTo(orderRowFor(normalizeTeam(row.team), 'post', groupId).actualByDate, String(row.record_date || ''), row.quantity)
    }

    const orderRows = [...orderRowMap.values()].sort(
      (a, b) =>
        a.groupKey.localeCompare(b.groupKey, 'ko') ||
        a.customer.localeCompare(b.customer, 'ko') ||
        a.orderLabel.localeCompare(b.orderLabel, 'ko'),
    )

    const daily: ProductionReportDailyRow[] = []
    // 안전장치: 잘못된 날짜 형식으로 무한루프 방지 (최대 62일)
    for (
      let date = startDate, steps = 0;
      date <= endDate && steps < 62;
      date = addDaysYmd(date, 1), steps += 1
    ) {
      const byTeam = dailyByDate.get(date) ?? {}
      const plannedByTeamForDate = dailyPlannedByDate.get(date) ?? {}
      daily.push({
        date,
        byTeam,
        plannedByTeam: plannedByTeamForDate,
        total: Object.values(byTeam).reduce((sum, value) => sum + value, 0),
        plannedTotal: Object.values(plannedByTeamForDate).reduce((sum, value) => sum + value, 0),
        smtByLine: dailySmtActualByLine.get(date) ?? {},
        smtPlannedByLine: dailySmtPlannedByLine.get(date) ?? {},
      })
    }

    return {
      ok: true,
      data: {
        startDate,
        endDate,
        smtLines: [...smtLineSet].sort((a, b) => a - b),
        orderRows,
        teams,
        daily,
        details,
        totalQuantity: teams.reduce((sum, team) => sum + team.quantity, 0),
        totalAmount: teams.reduce((sum, team) => sum + team.amount, 0),
        totalOverdueOrders,
        totalPlannedQuantity: teams.reduce((sum, team) => sum + team.plannedQuantity, 0),
        totalAchievementRate: achievementRate(
          teams.reduce((sum, team) => sum + team.plannedQuantity, 0),
          [...producedPastByTeam.values()].reduce((sum, value) => sum + value, 0),
        ),
      },
    }
  } catch (error) {
    return {
      ok: false,
      reason: 'query',
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}
