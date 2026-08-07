import type { OrderCategory } from '@/lib/orders/types'
import { ERP_BADGE_CLASS } from '@/lib/ui/tokens'

const STYLES: Record<OrderCategory, string> = {
  양산: 'bg-blue-100 text-blue-800',
  샘플: 'bg-amber-100 text-amber-800',
  자재: 'bg-violet-100 text-violet-800',
}

export function OrderCategoryBadge({ category }: { category: OrderCategory }) {
  return (
    <span
      className={`${ERP_BADGE_CLASS} ${STYLES[category] || 'bg-slate-100 text-slate-600'}`}
    >
      {category}
    </span>
  )
}
