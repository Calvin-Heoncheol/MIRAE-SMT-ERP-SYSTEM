import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/** BOM은 품목등록(반제품·조립제품) BOM 컬럼에서 관리 */
export default function MasterBomPageRedirect() {
  redirect('/master/products?category=3')
}
