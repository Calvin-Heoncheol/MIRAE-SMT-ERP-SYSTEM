import { redirect } from 'next/navigation'

/** 생산계획은 /production/plan 탭으로 통합 */
export default function SmtPlanPageRedirect() {
  redirect('/production/plan')
}
