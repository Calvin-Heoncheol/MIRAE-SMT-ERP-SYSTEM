import { assertCanWrite } from '@/lib/auth/assert-can-write'
import { stripCreatedByFields, withCreatedByFields } from '@/lib/auth/created-by'
import { todayYmdSeoul } from '@/lib/orders/utils'
import {
  firstNonEmptyPaymentTermSnapshot,
  isEmptyPaymentTermSnapshot,
  isMissingPaymentTermSnapshotColumn,
  paymentTermSnapshotFromDbRow,
  type PaymentTermSnapshot,
} from '@/lib/partners/payment-term-snapshot'
import { fetchBusinessPartners } from '@/lib/partners/repository'
import { findPartnerByName } from '@/lib/partners/utils'
import {
  fetchSalesReportData,
  groupSalesReportShipments,
} from '@/lib/reports/sales-report'
import { createSupabaseClient } from '@/lib/supabase'
import type { CreateStatementPaymentInput, ReceivableRow, StatementPayment } from './types'
import { buildReceivableRow } from './utils'

export type FetchReceivablesResult =
  | {
      ok: true
      startDate: string
      endDate: string
      rows: ReceivableRow[]
      paymentsMissing: boolean
      partnersMissing: boolean
      warning: string | null
    }
  | { ok: false; reason: 'env' | 'query'; detail: string }

export type SaveStatementPaymentResult =
  | { ok: true; payment: StatementPayment }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

export type DeleteStatementPaymentResult =
  | { ok: true }
  | { ok: false; reason: 'env' | 'query' | 'validation' | 'auth'; detail: string }

function missingEnvResult<T extends { ok: false; reason: 'env'; detail: string }>(): T {
  return {
    ok: false,
    reason: 'env',
    detail: 'NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY 가 없습니다.',
  } as T
}

export function isMissingStatementPaymentsTable(detail: string) {
  const message = String(detail || '').toLowerCase()
  return (
    message.includes('statement_payments') ||
    (message.includes('schema cache') && message.includes('statement_payments'))
  )
}

function mapPaymentRow(row: {
  id?: string | null
  shipment_id?: string | null
  paid_date?: string | null
  amount?: number | null
  note?: string | null
  created_by_name?: string | null
  created_at?: string | null
}): StatementPayment | null {
  const id = String(row.id || '').trim()
  const shipmentId = String(row.shipment_id || '').trim()
  const paidDate = String(row.paid_date || '').slice(0, 10)
  const amount = Math.round(Number(row.amount) || 0)
  if (!id || !shipmentId || !/^\d{4}-\d{2}-\d{2}$/.test(paidDate) || amount <= 0) return null
  return {
    id,
    shipmentId,
    paidDate,
    amount,
    note: String(row.note || '').trim(),
    createdByName: String(row.created_by_name || '').trim(),
    createdAt: String(row.created_at || ''),
  }
}

async function fetchStatementPayments(
  shipmentIds: string[],
): Promise<
  | { ok: true; payments: StatementPayment[]; missingTable: boolean }
  | { ok: false; reason: 'env' | 'query'; detail: string }
> {
  if (!shipmentIds.length) return { ok: true, payments: [], missingTable: false }

  const supabase = createSupabaseClient()
  if (!supabase) return missingEnvResult()

  const payments: StatementPayment[] = []
  const chunkSize = 200
  for (let index = 0; index < shipmentIds.length; index += chunkSize) {
    const chunk = shipmentIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('statement_payments')
      .select('id, shipment_id, paid_date, amount, note, created_by_name, created_at')
      .in('shipment_id', chunk)
      .order('paid_date', { ascending: false })

    if (error) {
      if (isMissingStatementPaymentsTable(error.message)) {
        return { ok: true, payments: [], missingTable: true }
      }
      return { ok: false, reason: 'query', detail: error.message }
    }

    for (const row of data || []) {
      const mapped = mapPaymentRow(row)
      if (mapped) payments.push(mapped)
    }
  }

  return { ok: true, payments, missingTable: false }
}

async function fetchPaymentSnapshotsForReceivables(input: {
  shipmentIds: string[]
  orderIds: string[]
}): Promise<{
  byShipment: Map<string, PaymentTermSnapshot>
  byOrder: Map<string, PaymentTermSnapshot>
  missingColumns: boolean
}> {
  const byShipment = new Map<string, PaymentTermSnapshot>()
  const byOrder = new Map<string, PaymentTermSnapshot>()
  const supabase = createSupabaseClient()
  if (!supabase) return { byShipment, byOrder, missingColumns: false }

  let missingColumns = false
  const chunkSize = 200

  for (let index = 0; index < input.shipmentIds.length; index += chunkSize) {
    const chunk = input.shipmentIds.slice(index, index + chunkSize)
    const { data, error } = await supabase
      .from('delivery_records')
      .select(
        'shipment_id, payment_term_type, payment_deposit_percent, payment_net_days, payment_monthly_day',
      )
      .in('shipment_id', chunk)

    if (error) {
      if (isMissingPaymentTermSnapshotColumn(error.message)) {
        missingColumns = true
        break
      }
      continue
    }

    for (const row of data || []) {
      const shipmentId = String(row.shipment_id || '').trim()
      const snapshot = paymentTermSnapshotFromDbRow(row)
      if (!shipmentId || isEmptyPaymentTermSnapshot(snapshot)) continue
      if (!byShipment.has(shipmentId)) byShipment.set(shipmentId, snapshot)
    }
  }

  if (!missingColumns) {
    for (let index = 0; index < input.orderIds.length; index += chunkSize) {
      const chunk = input.orderIds.slice(index, index + chunkSize)
      const { data, error } = await supabase
        .from('orders')
        .select('id, payment_term_type, payment_deposit_percent, payment_net_days, payment_monthly_day')
        .in('id', chunk)

      if (error) {
        if (isMissingPaymentTermSnapshotColumn(error.message)) {
          missingColumns = true
          break
        }
        continue
      }

      for (const row of data || []) {
        const orderId = String(row.id || '').trim()
        const snapshot = paymentTermSnapshotFromDbRow(row)
        if (!orderId || isEmptyPaymentTermSnapshot(snapshot)) continue
        byOrder.set(orderId, snapshot)
      }
    }
  }

  return { byShipment, byOrder, missingColumns }
}

function snapshotForReceivableGroup(
  group: { shipmentId: string; orderId: string },
  snapshots: {
    byShipment: Map<string, PaymentTermSnapshot>
    byOrder: Map<string, PaymentTermSnapshot>
  },
): PaymentTermSnapshot | null {
  const fromShipment = snapshots.byShipment.get(group.shipmentId)
  if (fromShipment && !isEmptyPaymentTermSnapshot(fromShipment)) return fromShipment

  const orderIds = String(group.orderId || '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
  return firstNonEmptyPaymentTermSnapshot(...orderIds.map((orderId) => snapshots.byOrder.get(orderId)))
}

export async function fetchReceivablesPageData(
  startDate: string,
  endDate: string,
): Promise<FetchReceivablesResult> {
  const [salesResult, partnersResult] = await Promise.all([
    fetchSalesReportData(startDate, endDate),
    fetchBusinessPartners(),
  ])

  if (!salesResult.ok) return salesResult

  const groups = groupSalesReportShipments(salesResult.data.shipments)
  const partners = partnersResult.ok ? partnersResult.partners : []
  const shipmentIds = [...new Set(groups.map((group) => group.shipmentId).filter(Boolean))]
  const paymentsResult = await fetchStatementPayments(shipmentIds)

  if (!paymentsResult.ok) {
    return { ok: false, reason: paymentsResult.reason, detail: paymentsResult.detail }
  }

  const today = todayYmdSeoul()
  const orderIds = [
    ...new Set(
      groups.flatMap((group) =>
        String(group.orderId || '')
          .split(',')
          .map((value) => value.trim())
          .filter(Boolean),
      ),
    ),
  ]
  const snapshots = await fetchPaymentSnapshotsForReceivables({ shipmentIds, orderIds })
  const rows = groups
    .map((group) =>
      buildReceivableRow({
        group,
        partner: findPartnerByName(partners, group.customer),
        snapshot: snapshotForReceivableGroup(group, snapshots),
        payments: paymentsResult.payments,
        today,
      }),
    )
    .sort((a, b) => {
      const byIssue = b.issueDate.localeCompare(a.issueDate)
      if (byIssue !== 0) return byIssue
      return b.shipmentId.localeCompare(a.shipmentId)
    })

  const warnings: string[] = []
  if (paymentsResult.missingTable) {
    warnings.push(
      '입금 테이블이 없습니다. supabase/migrate-statement-payments.sql 을 실행하면 입금 여부를 기록할 수 있습니다.',
    )
  }
  if (snapshots.missingColumns) {
    warnings.push(
      '결제조건 스냅샷 컬럼이 없습니다. supabase/migrate-payment-term-snapshots.sql 을 실행하면 거래처 수정 후에도 입금예정일이 유지됩니다.',
    )
  }
  if (!partnersResult.ok && rows.some((row) => !row.paymentTermType)) {
    warnings.push('거래처 결제조건을 불러오지 못해 입금 예정일을 계산하지 못한 건이 있습니다.')
  }

  return {
    ok: true,
    startDate,
    endDate,
    rows,
    paymentsMissing: paymentsResult.missingTable,
    partnersMissing: !partnersResult.ok,
    warning: warnings.length ? warnings.join(' ') : null,
  }
}

function validatePaymentInput(input: CreateStatementPaymentInput) {
  const shipmentId = String(input.shipmentId || '').trim()
  const paidDate = String(input.paidDate || '').slice(0, 10)
  const amount = Math.round(Number(input.amount) || 0)
  const note = String(input.note || '').trim()

  if (!shipmentId) return { ok: false as const, detail: '출하번호가 없습니다.' }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(paidDate)) {
    return { ok: false as const, detail: '입금일을 확인하세요.' }
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return { ok: false as const, detail: '입금 금액은 1원 이상이어야 합니다.' }
  }

  return { ok: true as const, shipmentId, paidDate, amount, note }
}

export async function createStatementPayment(
  input: CreateStatementPaymentInput,
): Promise<SaveStatementPaymentResult> {
  const guard = await assertCanWrite({ module: 'accounting', action: 'create' })
  if (!guard.ok) return { ok: false, reason: 'auth', detail: guard.detail }

  const validated = validatePaymentInput(input)
  if (!validated.ok) return { ok: false, reason: 'validation', detail: validated.detail }

  const supabase = createSupabaseClient()
  if (!supabase) return missingEnvResult()

  const baseRow = {
    shipment_id: validated.shipmentId,
    paid_date: validated.paidDate,
    amount: validated.amount,
    note: validated.note,
  }
  const withMeta = await withCreatedByFields(baseRow)

  let { data, error } = await supabase
    .from('statement_payments')
    .insert(withMeta)
    .select('id, shipment_id, paid_date, amount, note, created_by_name, created_at')
    .single()

  if (error && (error.message.includes('created_by') || error.message.includes('created_by_name'))) {
    const retry = await supabase
      .from('statement_payments')
      .insert(stripCreatedByFields(withMeta))
      .select('id, shipment_id, paid_date, amount, note, created_by_name, created_at')
      .single()
    data = retry.data
    error = retry.error
  }

  if (error) {
    if (isMissingStatementPaymentsTable(error.message)) {
      return {
        ok: false,
        reason: 'query',
        detail: '입금 테이블이 없습니다. supabase/migrate-statement-payments.sql 을 실행하세요.',
      }
    }
    return { ok: false, reason: 'query', detail: error.message }
  }

  const payment = data ? mapPaymentRow(data) : null
  if (!payment) return { ok: false, reason: 'query', detail: '입금 기록을 저장하지 못했습니다.' }
  return { ok: true, payment }
}

export async function deleteStatementPayment(id: string): Promise<DeleteStatementPaymentResult> {
  const guard = await assertCanWrite({ module: 'accounting', action: 'delete' })
  if (!guard.ok) return { ok: false, reason: 'auth', detail: guard.detail }

  const paymentId = String(id || '').trim()
  if (!paymentId) return { ok: false, reason: 'validation', detail: '삭제할 입금 내역이 없습니다.' }

  const supabase = createSupabaseClient()
  if (!supabase) return missingEnvResult()

  const { error } = await supabase.from('statement_payments').delete().eq('id', paymentId)
  if (error) {
    if (isMissingStatementPaymentsTable(error.message)) {
      return {
        ok: false,
        reason: 'query',
        detail: '입금 테이블이 없습니다. supabase/migrate-statement-payments.sql 을 실행하세요.',
      }
    }
    return { ok: false, reason: 'query', detail: error.message }
  }

  return { ok: true }
}
