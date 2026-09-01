import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** 생산계획은 /production/plan 으로 통합 */
export default function PostProcessPlanPageRedirect() {
  redirect('/production/plan')
}
