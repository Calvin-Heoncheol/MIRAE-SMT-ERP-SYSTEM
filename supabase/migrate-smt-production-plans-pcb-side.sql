-- Supabase SQL Editor에서 실행하세요
-- (migrate-smt-production-plans-order-line.sql 이후)
-- SMT 생산계획에 면구분(pcb_side) 추가 — 양면 TOP/BOT 구분

alter table public.smt_production_plans
  add column if not exists pcb_side text not null default 'SINGLE';

alter table public.smt_production_plans
  drop constraint if exists smt_production_plans_pcb_side_check;

alter table public.smt_production_plans
  add constraint smt_production_plans_pcb_side_check
  check (pcb_side in ('SINGLE', 'TOP', 'BOT'));

-- UNIQUE에 면구분 포함 (같은 일·라인에 TOP/BOT 동시 배치 가능)
alter table public.smt_production_plans
  drop constraint if exists smt_production_plans_order_line_id_planned_date_line_no_key;

alter table public.smt_production_plans
  drop constraint if exists smt_production_plans_order_line_id_planned_date_line_no_pcb_side_key;

alter table public.smt_production_plans
  add constraint smt_production_plans_order_line_id_planned_date_line_no_pcb_side_key
  unique (order_line_id, planned_date, line_no, pcb_side);

comment on column public.smt_production_plans.pcb_side is '면구분: SINGLE / TOP / BOT (양면 제품은 TOP 또는 BOT)';
comment on table public.smt_production_plans is 'SMT 생산계획 — 주문 라인·면·일자·SMT 라인별 계획 수량';
