-- Supabase SQL Editor에서 실행하세요
-- 입고 및 불출 — 발주 품목별 실제입고일 (migrate-material-expected-inbound.sql 이후)

alter table public.material_order_expected_inbound
  add column if not exists actual_date date;

-- 실제입고일만 있고 예상입고일은 없는 행 허용
alter table public.material_order_expected_inbound
  alter column expected_date drop not null;

comment on column public.material_order_expected_inbound.actual_date is '자재 실제입고일';
