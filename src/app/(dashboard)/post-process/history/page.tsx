import { redirect } from 'next/navigation'

/** 구 후공정 생산이력 → 통합 생산이력 */
export default function PostProcessHistoryRedirectPage() {
  redirect('/production/history')
}
