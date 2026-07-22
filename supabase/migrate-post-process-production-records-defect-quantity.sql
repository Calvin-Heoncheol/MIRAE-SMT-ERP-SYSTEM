-- Supabase SQL Editor에서 실행하세요
-- (setup-post-process-production.sql 이후)
-- 후공정 생산실적에 불량 수량(defect_quantity) 추가 — 진행률/잔량은 양품(quantity)만 기준

alter table public.post_process_production_records
  add column if not exists defect_quantity integer not null default 0;

alter table public.post_process_production_records
  drop constraint if exists post_process_production_records_defect_quantity_check;

alter table public.post_process_production_records
  add constraint post_process_production_records_defect_quantity_check
  check (defect_quantity >= 0);

comment on column public.post_process_production_records.quantity is '이번 등록 양품(완제품 세트) 수량';
comment on column public.post_process_production_records.defect_quantity is '이번 등록 불량 수량 (진행률·잔량 계산에 미포함)';
