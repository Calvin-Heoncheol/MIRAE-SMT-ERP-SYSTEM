import type { AuthDepartment, AuthRole } from '@/lib/auth/types'

export type NotificationCategory =
  | 'delivery'
  | 'stock'
  | 'purchase'
  | 'approval'
  | 'expense'
  | 'leave'

export type NotificationTone = 'warn' | 'danger' | 'info'

export type AppNotification = {
  key: string
  category: NotificationCategory
  label: string
  detail: string
  href: string
  tone: NotificationTone
}

export type NotificationFeed = {
  items: AppNotification[]
  fetchedAt: string
}

/** 부서·역할별 알림 카테고리 (admin/manager는 전체) */
export function notificationCategoriesForProfile(input: {
  role: AuthRole
  department: AuthDepartment | null
}): NotificationCategory[] {
  if (input.role === 'admin' || input.role === 'manager') {
    return ['delivery', 'stock', 'purchase', 'approval', 'expense', 'leave']
  }

  switch (input.department) {
    case 'sales':
      return ['delivery']
    case 'materials':
      return ['stock', 'purchase']
    case 'production1':
    case 'production2':
    case 'production3':
    case 'production4':
      return ['delivery', 'stock']
    case 'quality':
      return ['delivery', 'stock', 'approval']
    case 'office':
      return ['approval', 'expense', 'leave']
    default:
      return ['delivery', 'stock', 'purchase', 'approval', 'expense', 'leave']
  }
}

export const NOTIFICATION_CATEGORY_LABELS: Record<NotificationCategory, string> = {
  delivery: '납기',
  stock: '재고',
  purchase: '발주',
  approval: '품의',
  expense: '지출',
  leave: '휴가',
}
