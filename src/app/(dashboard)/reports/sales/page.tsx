import { redirect } from 'next/navigation'

/** 거래명세서는 출하 및 거래명세서 화면으로 통합됨 */
export default function SalesReportPage() {
  redirect('/delivery/input')
}
