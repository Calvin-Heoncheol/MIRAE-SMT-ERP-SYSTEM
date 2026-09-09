import { redirect } from 'next/navigation'

/** 구 SMT 생산이력 → 생산등록 생산이력 탭 */
export default function SmtHistoryRedirectPage() {
  redirect('/production/input?team=생산1팀&view=history')
}
