-- Supabase SQL Editor에서 실행하세요
-- (migrate-smt-production-records-defect-quantity.sql 이후)
-- 불량 전용 등록: quantity(양품)=0, defect_quantity>0 허용

alter table public.smt_production_records
  drop constraint if exists smt_production_records_quantity_check;

alter table public.smt_production_records
  add constraint smt_production_records_quantity_check
  check (quantity >= 0);

alter table public.smt_production_records
  drop constraint if exists smt_production_records_qty_or_defect_check;

alter table public.smt_production_records
  add constraint smt_production_records_qty_or_defect_check
  check (quantity > 0 or defect_quantity > 0);

comment on column public.smt_production_records.quantity is '이번 등록 양품 수량 (불량 전용 등록 시 0)';
