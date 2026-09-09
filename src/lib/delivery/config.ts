import type { ProductionInputConfig } from '@/lib/production-input/types'

export const DELIVERY_INPUT_CONFIG: ProductionInputConfig = {
  productKindLabel: '출하',
  fetchErrorTitle: '출하 데이터를 불러오지 못했습니다',
  qtyInputId: 'delivery-qty-input',
  productionModule: 'delivery',
}

/**
 * 출하 수량 상한 = 발주(조립) 목표 − 출하 누적.
 * 생산실적(SMT/후공정) 완료 상한은 쓰지 않는다.
 */
export const DELIVERY_REGISTER_SKIP_PRODUCTION_CAP = true

/**
 * 출하 저장 시 production_lots 동기화·배정 여부.
 * false면 출하는 발주 잔량만으로 등록되고 LOT/생산실적과 분리된다.
 */
export const DELIVERY_PERSIST_PRODUCTION_LOTS = false
