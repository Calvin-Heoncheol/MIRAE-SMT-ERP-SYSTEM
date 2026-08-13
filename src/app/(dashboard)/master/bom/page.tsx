import { BomWorkspace } from '@/components/bom/bom-workspace'
import { fetchBomLines } from '@/lib/bom/repository'
import { fetchItems } from '@/lib/items/repository'

/** 품목등록 직후 목록이 바로 반영되도록 매 요청 조회 */
export const dynamic = 'force-dynamic'

export default async function MasterBomPage() {
  // 품목등록과 동일하게 전체 품목을 가져온 뒤, BOM 대상(반·조립)만 화면에 표시
  const [bomResult, itemsResult] = await Promise.all([fetchBomLines(), fetchItems(false)])
  return <BomWorkspace bomResult={bomResult} itemsResult={itemsResult} />
}
