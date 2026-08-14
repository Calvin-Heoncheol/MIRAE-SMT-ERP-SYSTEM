# Setup SQL — 최종 스키마 기준

신규 DB는 **`setup-*.sql`만으로 테이블·뷰·기본 트리거를 맞춘다**.  
`migrate-*.sql`은 **이미 운영 중인 DB**에 컬럼/제약을 보강할 때 쓴다 (일회성 백필·renames 포함).

## 권장 실행 순서 (신규)

1. `setup-profiles.sql`
2. `setup-business-partners.sql`
3. `setup-items.sql`
4. `setup-bom.sql` (조립그룹 포함)
5. `setup-quotations.sql`
6. `setup-orders.sql`
7. `setup-new-company-inquiries.sql`
8. `setup-smt-production.sql` → `setup-smt-production-plans.sql`
9. `setup-post-process-production.sql` → `setup-post-process-production-plans.sql`
10. `setup-delivery-production.sql` (출하 + atomic RPC 포함)
11. `setup-production-plan-board.sql`
12. `setup-material-purchase-orders.sql` → inbound / outbound
13. 품질·결재·설비: `setup-quality-defect-handlings.sql`, approvals, leave, expense, metal-masks, squeegees …
14. 회계 수금: `setup-statement-payments.sql`

## RPC (함수) — 운영·신규 공통

| 기능 | 최종 정의 파일 |
|------|----------------|
| 출하 원자 등록 | `setup-delivery-production.sql` 하단 (= `migrate-delivery-shipment-id-fix.sql`) |
| SMT 원자 등록 | `migrate-atomic-quantity-inserts.sql` (`insert_smt_production_atomic`) |
| 후공정 원자 등록 | `migrate-fix-assembly-group-id-uuid-rpc.sql` (uuid 시그니처) |
| 주문서 원자 저장 | `migrate-save-order-rpc.sql` |

신규라도 SMT/후공정/주문서 RPC는 위 migrate를 **한 번** 실행한다 (테이블 setup 이후).

## setup에 반영된 주요 컬럼 (이번 동기화)

- `created_by` / `created_by_name`: 출하, 주문, 발주, 신규업체, SMT/후공정 **계획**
- 계획: `planned_end_date`, `plan_status`
- 품목: `safety_stock` (+ check)
- 신규업체: `close_reason`
- 생산계획 보드: `setup-production-plan-board.sql` (일정 컬럼 포함)

## 일회성 — setup에 넣지 않음

데이터 변환·백필은 migrate만 유지 (예: base_code 파싱, dual→double, shipment_id 백필, 상태값 rename).

## 출하·주문·견적 번호 형식

- 출하: `MRS-YYMMDD-NN` — `migrate-delivery-number-yymmdd.sql`
- 생산 LOT: `LOT-YYMMDD-NN` — `migrate-production-lots.sql` (`production_lots` + `delivery_record_lots`, 후공정 일자별 백필)
- 주문 자동발급: `MRO-YYMMDD-NN` (비우면, 주문일 기준) — `migrate-order-quote-number-yymmdd.sql`
- 견적: `MRQ-YYMMDD-NN` — 동일 migrate
- 자재 발주: `MRP-YYMMDD-NN` (기존)
- 품목 내부 PK: `MR-00001` — `migrate-items-internal-id-mr.sql` (표시 코드는 `base_code`)
- 입고 릴 LOT: `MRL-YYMMDD-NNNN` — `migrate-inbound-reel-lot.sql` (`material_inbound_lines.lot_number`)
- 거래처 결제조건: `migrate-partners-payment-terms.sql` (분할/일반후불/월괄후불)
- 결제조건 스냅샷(견적·발주·출하): `migrate-payment-term-snapshots.sql` (거래처 수정 후에도 입금예정일 유지)
- 거래명세서 입금(수금): `migrate-statement-payments.sql` (`statement_payments`)
- 구형식·수동 PO/NO는 유지

## RLS

현재 setup 다수는 `using (true)` 공개 정책.  
강화 RLS가 필요하면 **이미 적용한 DB**에 `migrate-rls-authenticated-writes.sql`을 쓰고, setup을 재실행해 공개 정책으로 되돌리지 않도록 주의한다.
