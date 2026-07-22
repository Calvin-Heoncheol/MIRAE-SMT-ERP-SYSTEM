import { redirect } from 'next/navigation'

/** 구 SMT 생산이력 → 통합 생산이력 */
export default function SmtHistoryRedirectPage() {
  redirect('/production/history')
}
