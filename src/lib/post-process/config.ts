import type { ProductionInputConfig } from '@/lib/production-input/types'

export const POST_PROCESS_PRODUCTION_INPUT_CONFIG: ProductionInputConfig = {
  productKindLabel: '완제품',
  fetchErrorTitle: '후공정 데이터를 불러오지 못했습니다',
  qtyInputId: 'post-qty-input',
  productionModule: 'post_process',
}
