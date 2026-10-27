export type PlanBadgeGroup = 'material' | 'smd' | 'post' | 'sales'

export type PlanBadgeKind =
  | 'material_expected'
  | 'material_inbound'
  | 'material_inspection'
  | 'smd_first'
  | 'smd_second'
  | 'post'
  | 'shipping'

/** production_plan_events 테이블에 저장되는 종류 */
export type PlanEventKind = Extract<
  PlanBadgeKind,
  'material_expected' | 'material_inspection' | 'shipping'
>

export const PLAN_EVENT_KINDS: PlanEventKind[] = [
  'material_expected',
  'material_inspection',
  'shipping',
]

export function isPlanEventKind(kind: PlanBadgeKind): kind is PlanEventKind {
  return (PLAN_EVENT_KINDS as PlanBadgeKind[]).includes(kind)
}

export const PLAN_BADGE_GROUPS: {
  group: PlanBadgeGroup
  label: string
  kinds: PlanBadgeKind[]
}[] = [
  { group: 'material', label: '자재', kinds: ['material_expected', 'material_inbound', 'material_inspection'] },
  { group: 'smd', label: 'SMD', kinds: ['smd_second', 'smd_first'] },
  { group: 'post', label: '후공정', kinds: ['post'] },
  { group: 'sales', label: '영업', kinds: ['shipping'] },
]

export const PLAN_BADGE_META: Record<
  PlanBadgeKind,
  { group: PlanBadgeGroup; label: string; short: string }
> = {
  material_expected: { group: 'material', label: '입고예정', short: '입고예정' },
  material_inbound: { group: 'material', label: '입고', short: '입고' },
  material_inspection: { group: 'material', label: '입고검사', short: '입고검사' },
  smd_first: { group: 'smd', label: 'SMD TOP', short: 'SMD TOP' },
  smd_second: { group: 'smd', label: 'SMD BOT', short: 'SMD BOT' },
  post: { group: 'post', label: '생산', short: '후공정' },
  shipping: { group: 'sales', label: '출하', short: '출하' },
}

export const PLAN_BADGE_GROUP_STYLE: Record<
  PlanBadgeGroup,
  { bar: string; tag: string; dot: string; chipOn: string; chipOff: string }
> = {
  material: {
    bar: 'border-emerald-500 bg-emerald-50 hover:bg-emerald-100',
    tag: 'bg-emerald-600 text-white',
    dot: 'bg-emerald-500',
    chipOn: 'border-emerald-500 bg-emerald-500 text-white',
    chipOff: 'border-emerald-200 bg-white text-emerald-700 hover:bg-emerald-50',
  },
  smd: {
    bar: 'border-sky-500 bg-sky-50 hover:bg-sky-100',
    tag: 'bg-sky-600 text-white',
    dot: 'bg-sky-500',
    chipOn: 'border-sky-500 bg-sky-500 text-white',
    chipOff: 'border-sky-200 bg-white text-sky-700 hover:bg-sky-50',
  },
  post: {
    bar: 'border-violet-500 bg-violet-50 hover:bg-violet-100',
    tag: 'bg-violet-600 text-white',
    dot: 'bg-violet-500',
    chipOn: 'border-violet-500 bg-violet-500 text-white',
    chipOff: 'border-violet-200 bg-white text-violet-700 hover:bg-violet-50',
  },
  sales: {
    bar: 'border-amber-500 bg-amber-50 hover:bg-amber-100',
    tag: 'bg-amber-600 text-white',
    dot: 'bg-amber-500',
    chipOn: 'border-amber-500 bg-amber-500 text-white',
    chipOff: 'border-amber-200 bg-white text-amber-700 hover:bg-amber-50',
  },
}

export const PLAN_BADGE_RANK: Record<PlanBadgeKind, number> = {
  material_expected: 0,
  material_inbound: 1,
  material_inspection: 2,
  smd_second: 3,
  smd_first: 4,
  post: 5,
  shipping: 6,
}
