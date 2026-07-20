import { ItemsWorkspace } from '@/components/items/items-workspace'
import { syncAllFinishedUnitPricesFromBom } from '@/lib/bom/repository'
import { fetchItems } from '@/lib/items/repository'

export default async function MasterProductsPage() {
  // 완제품 단가 = BOM 구성 단가×소요량 합산으로 DB 동기화 후 목록 조회
  await syncAllFinishedUnitPricesFromBom()
  const result = await fetchItems(false)
  return <ItemsWorkspace result={result} />
}
