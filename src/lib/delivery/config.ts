import type { ProductionInputConfig } from '@/lib/production-input/types'

export const DELIVERY_INPUT_CONFIG: ProductionInputConfig = {
  productKindLabel: '출하',
  fetchErrorTitle: '출하 데이터를 불러오지 못했습니다',
  qtyInputId: 'delivery-qty-input',
  productionModule: 'delivery',
}

function envFlag(names: string[], fallback: boolean): boolean {
  for (const name of names) {
    const raw = process.env[name]
    if (raw == null || raw === '') continue
    const normalized = raw.trim().toLowerCase()
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false
  }
  return fallback
}

/**
 * 출하 수량 상한 = 발주(조립) 목표 − 출하 누적.
 * true면 생산실적(SMT/후공정) 완료 상한을 쓰지 않는다.
 * env: NEXT_PUBLIC_DELIVERY_REGISTER_SKIP_PRODUCTION_CAP (또는 DELIVERY_REGISTER_SKIP_PRODUCTION_CAP)
 */
export const DELIVERY_REGISTER_SKIP_PRODUCTION_CAP = envFlag(
  [
    'NEXT_PUBLIC_DELIVERY_REGISTER_SKIP_PRODUCTION_CAP',
    'DELIVERY_REGISTER_SKIP_PRODUCTION_CAP',
  ],
  true,
)

/**
 * 출하 저장 시 production_lots 동기화·배정 여부.
 * false면 출하는 발주 잔량만으로 등록되고 LOT/생산실적과 분리된다.
 * env: NEXT_PUBLIC_DELIVERY_PERSIST_PRODUCTION_LOTS (또는 DELIVERY_PERSIST_PRODUCTION_LOTS)
 */
export const DELIVERY_PERSIST_PRODUCTION_LOTS = envFlag(
  ['NEXT_PUBLIC_DELIVERY_PERSIST_PRODUCTION_LOTS', 'DELIVERY_PERSIST_PRODUCTION_LOTS'],
  false,
)
