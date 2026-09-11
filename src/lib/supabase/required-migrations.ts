/**
 * 원자성·데이터 무결성에 필수인 RPC. 미적용 시 레거시 비원자 폴백을 쓰지 않고 안내한다.
 * (앱 기동 시 강제 적용은 없으므로, 저장 경로에서 이 메시지를 반환한다.)
 */
export const REQUIRED_RPC_MIGRATIONS = {
  save_order_create:
    'supabase/migrate-save-order-rpc.sql → migrate-order-lines-price-breakdown.sql → migrate-orders-customer-yymmdd-id.sql',
  save_order_update:
    'supabase/migrate-save-order-update-line-seq-fix.sql (또는 migrate-order-lines-work-number.sql)',
  insert_delivery_record_atomic: 'supabase/migrate-delivery-shipment-id-fix.sql',
} as const

/** 권장 수동 migrate (정본·정규화) — SQL Editor에서 확인 */
export const RECOMMENDED_SCHEMA_MIGRATIONS = [
  'supabase/migrate-orders-canonical-id-work-number.sql',
  'supabase/migrate-delivery-extra-lines.sql',
  'supabase/migrate-items-material-cost-lines.sql',
] as const

export type RequiredRpcName = keyof typeof REQUIRED_RPC_MIGRATIONS

export function missingRpcMigrationMessage(rpcName: RequiredRpcName) {
  const file = REQUIRED_RPC_MIGRATIONS[rpcName]
  return `필수 DB 함수(${rpcName})가 없습니다. Supabase SQL Editor에서 ${file} 을 실행한 뒤 다시 시도해 주세요. (비원자 폴백은 차단되었습니다.)`
}
