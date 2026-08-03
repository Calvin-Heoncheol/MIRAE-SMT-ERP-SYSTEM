import type { AuthProfile } from '@/lib/auth/types'
import { createSupabaseServerClient } from '@/lib/supabase/server'
import {
  ACTIVITY_KIND_LABELS,
  type ActivityNotification,
  type ActivityNotificationFeed,
  type ActivityNotificationKind,
} from './types'

const LOOKBACK_DAYS = 7
const PER_SOURCE_LIMIT = 12
const FEED_LIMIT = 30

type ActivitySource = {
  kind: ActivityNotificationKind
  table: string
  href: string
  /** select 컬럼 — id, created_at 필수. created_by* 있으면 사용 */
  select: string
  build: (row: Record<string, unknown>) => { title: string; detail: string } | null
}

function sinceIso() {
  const date = new Date()
  date.setDate(date.getDate() - LOOKBACK_DAYS)
  return date.toISOString()
}

function actorLabel(row: Record<string, unknown>) {
  const name = String(row.created_by_name || '').trim()
  return name || '누군가'
}

const SOURCES: ActivitySource[] = [
  {
    kind: 'order',
    table: 'orders',
    href: '/orders',
    select: 'id, customer, created_at, created_by, created_by_name',
    build: (row) => {
      const id = String(row.id || '').trim()
      if (!id) return null
      const customer = String(row.customer || '').trim() || '—'
      return {
        title: '주문서 등록',
        detail: `${id} · ${customer}`,
      }
    },
  },
  {
    kind: 'quote',
    table: 'quotations',
    href: '/quotations',
    select: 'id, customer, product_name, created_at, created_by, created_by_name',
    build: (row) => {
      const id = String(row.id || '').trim()
      if (!id) return null
      const customer = String(row.customer || '').trim() || '—'
      const product = String(row.product_name || '').trim()
      return {
        title: '견적서 등록',
        detail: product ? `${id} · ${customer} · ${product}` : `${id} · ${customer}`,
      }
    },
  },
  {
    kind: 'delivery',
    table: 'delivery_records',
    href: '/delivery/history',
    select: 'id, quantity, record_date, created_at, created_by, created_by_name',
    build: (row) => {
      const id = String(row.id || '').trim()
      if (!id) return null
      const qty = Number(row.quantity) || 0
      const date = String(row.record_date || '').trim()
      return {
        title: '출하 등록',
        detail: `${id} · ${qty.toLocaleString('ko-KR')}EA${date ? ` · ${date}` : ''}`,
      }
    },
  },
  {
    kind: 'purchase',
    table: 'material_purchase_orders',
    href: '/materials/purchase-orders',
    select: 'id, supplier, created_at, created_by, created_by_name',
    build: (row) => {
      const id = String(row.id || '').trim()
      if (!id) return null
      const supplier = String(row.supplier || '').trim() || '—'
      return {
        title: '발주서 등록',
        detail: `${id} · ${supplier}`,
      }
    },
  },
  {
    kind: 'inbound',
    table: 'material_inbound_records',
    href: '/materials/inbound',
    select: 'id, inbound_date, inbound_type, created_at, created_by, created_by_name',
    build: (row) => {
      const id = String(row.id || '').trim()
      if (!id) return null
      const date = String(row.inbound_date || '').trim()
      const type = String(row.inbound_type || '').trim()
      return {
        title: '입고 등록',
        detail: [id, type, date].filter(Boolean).join(' · '),
      }
    },
  },
  {
    kind: 'outbound',
    table: 'material_outbound_records',
    href: '/materials/outbound',
    select: 'id, outbound_date, outbound_type, order_id, created_at, created_by, created_by_name',
    build: (row) => {
      const id = String(row.id || '').trim()
      if (!id) return null
      const orderId = String(row.order_id || '').trim()
      const date = String(row.outbound_date || '').trim()
      return {
        title: '불출 등록',
        detail: [id, orderId, date].filter(Boolean).join(' · '),
      }
    },
  },
  {
    kind: 'approval',
    table: 'approvals',
    href: '/approvals',
    select: 'id, doc_number, subject, created_at, created_by, created_by_name',
    build: (row) => {
      const no = String(row.doc_number || row.id || '').trim()
      const subject = String(row.subject || '').trim() || '품의서'
      return {
        title: '품의서 등록',
        detail: `${no} · ${subject}`,
      }
    },
  },
  {
    kind: 'leave',
    table: 'leave_requests',
    href: '/leave-requests',
    select: 'id, doc_number, author, created_at, created_by, created_by_name',
    build: (row) => {
      const no = String(row.doc_number || row.id || '').trim()
      const author = String(row.author || '').trim()
      return {
        title: '휴가원 등록',
        detail: author ? `${no} · ${author}` : no,
      }
    },
  },
  {
    kind: 'expense',
    table: 'expense_reports',
    href: '/expense-reports',
    select: 'id, doc_number, account_category, created_at, created_by, created_by_name',
    build: (row) => {
      const no = String(row.doc_number || row.id || '').trim()
      const category = String(row.account_category || '').trim()
      return {
        title: '지출결의 등록',
        detail: category ? `${no} · ${category}` : no,
      }
    },
  },
  {
    kind: 'smt_production',
    table: 'smt_production_records',
    href: '/smt',
    select: 'id, quantity, record_date, created_at, created_by, created_by_name',
    build: (row) => {
      const qty = Number(row.quantity) || 0
      const date = String(row.record_date || '').trim()
      return {
        title: 'SMT 생산 등록',
        detail: `${qty.toLocaleString('ko-KR')}EA${date ? ` · ${date}` : ''}`,
      }
    },
  },
  {
    kind: 'post_production',
    table: 'post_process_production_records',
    href: '/post-process',
    select: 'id, quantity, record_date, team, created_at, created_by, created_by_name',
    build: (row) => {
      const qty = Number(row.quantity) || 0
      const team = String(row.team || '').trim()
      return {
        title: '후공정 생산 등록',
        detail: `${qty.toLocaleString('ko-KR')}EA${team ? ` · ${team}` : ''}`,
      }
    },
  },
  {
    kind: 'new_company',
    table: 'new_company_inquiries',
    href: '/new-companies',
    select: 'id, company_name, created_at, created_by, created_by_name',
    build: (row) => {
      const name = String(row.company_name || '').trim() || '신규업체'
      return {
        title: '신규업체 등록',
        detail: name,
      }
    },
  },
]

async function fetchSourceRows(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  source: ActivitySource,
  since: string,
) {
  const primary = await supabase
    .from(source.table)
    .select(source.select)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(PER_SOURCE_LIMIT)

  if (!primary.error) {
    return (primary.data || []) as Record<string, unknown>[]
  }

  // created_by 컬럼 없는 DB 호환
  const legacySelect = source.select
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== 'created_by' && part !== 'created_by_name')
    .join(', ')

  const legacy = await supabase
    .from(source.table)
    .select(legacySelect)
    .gte('created_at', since)
    .order('created_at', { ascending: false })
    .limit(PER_SOURCE_LIMIT)

  if (legacy.error) return []
  return (legacy.data || []) as Record<string, unknown>[]
}

export async function fetchActivityNotificationFeed(
  profile: AuthProfile | null,
): Promise<ActivityNotificationFeed> {
  const supabase = await createSupabaseServerClient()
  const since = sinceIso()
  const viewerId = profile?.id && profile.id !== 'dev' ? profile.id : null

  const batches = await Promise.all(
    SOURCES.map(async (source) => {
      const rows = await fetchSourceRows(supabase, source, since)
      const items: ActivityNotification[] = []

      for (const row of rows) {
        const createdBy = row.created_by == null ? null : String(row.created_by)
        // 본인이 등록한 건은 알림에서 제외
        if (viewerId && createdBy && createdBy === viewerId) continue

        const built = source.build(row)
        if (!built) continue

        const createdAt = String(row.created_at || '').trim()
        if (!createdAt) continue

        const rowId = String(row.id || createdAt)
        items.push({
          key: `${source.kind}:${rowId}`,
          kind: source.kind,
          title: built.title,
          detail: built.detail,
          href: source.href,
          actorName: actorLabel(row),
          createdAt,
        })
      }

      return items
    }),
  )

  const items = batches
    .flat()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, FEED_LIMIT)

  return {
    items,
    fetchedAt: new Date().toISOString(),
  }
}

export function activityKindLabel(kind: ActivityNotificationKind) {
  return ACTIVITY_KIND_LABELS[kind]
}
