import type { ProductionInputConfig } from '@/lib/production-input/types'

export const DELIVERY_INPUT_CONFIG: ProductionInputConfig = {
  productKindLabel: '출하',
  fetchErrorTitle: '출하 데이터를 불러오지 못했습니다',
  qtyInputId: 'delivery-qty-input',
  productionModule: 'delivery',
}

/** 임시: 출하 등록 시 후공정 생산완료 상한 없이 발주 잔량까지만 허용 (추후 false 로 복원) */
export const DELIVERY_REGISTER_SKIP_PRODUCTION_CAP = true
