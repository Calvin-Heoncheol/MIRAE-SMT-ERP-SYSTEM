export type ActivityNotificationKind =
  | 'order'
  | 'quote'
  | 'delivery'
  | 'purchase'
  | 'inbound'
  | 'outbound'
  | 'approval'
  | 'leave'
  | 'expense'
  | 'smt_production'
  | 'post_production'
  | 'new_company'

export type ActivityNotification = {
  key: string
  kind: ActivityNotificationKind
  title: string
  detail: string
  href: string
  actorName: string
  createdAt: string
}

export type ActivityNotificationFeed = {
  items: ActivityNotification[]
  fetchedAt: string
}

export const ACTIVITY_KIND_LABELS: Record<ActivityNotificationKind, string> = {
  order: '발주서',
  quote: '견적',
  delivery: '출하',
  purchase: '구매발주',
  inbound: '입고',
  outbound: '불출',
  approval: '품의',
  leave: '휴가',
  expense: '지출',
  smt_production: 'SMT',
  post_production: '후공정',
  new_company: '신규업체',
}
