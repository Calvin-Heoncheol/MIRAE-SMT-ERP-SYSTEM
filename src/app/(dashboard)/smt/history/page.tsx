import { redirect } from 'next/navigation'

/** 구 SMT 생산이력 → 팀별 생산이력 */
export default function SmtHistoryRedirectPage() {
  redirect('/production/history?team=생산1팀')
}
