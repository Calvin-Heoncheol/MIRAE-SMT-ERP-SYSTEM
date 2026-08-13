-- Supabase SQL Editor에서 실행하세요
-- SMT 생산계획을 주문서 라인이 아닌 주문 라인(order_lines) 단위로 전환

-- 1) order_line_id 컬럼 추가
alter table public.smt_production_plans
  add column if not exists order_line_id uuid references public.order_lines(id) on delete cascade;

-- 2) 기존 계획: 해당 주문의 첫 번째 라인으로 백필 (다중 라인 주문은 수동 확인 권장)
update public.smt_production_plans p
set order_line_id = sub.id
from (
  select distinct on (ol.order_id) ol.id, ol.order_id
  from public.order_lines ol
  order by ol.order_id, ol.line_seq nulls last, ol.id
) sub
where p.order_id = sub.order_id
  and p.order_line_id is null;

-- 3) 매핑 불가 행 제거 후 NOT NULL
delete from public.smt_production_plans where order_line_id is null;

alter table public.smt_production_plans
  alter column order_line_id set not null;

create index if not exists smt_production_plans_order_line_id_idx
  on public.smt_production_plans (order_line_id);

-- 4) UNIQUE: 주문 라인 · 일자 · SMT 라인
alter table public.smt_production_plans
  drop constraint if exists smt_production_plans_order_id_planned_date_line_no_key;

alter table public.smt_production_plans
  drop constraint if exists smt_production_plans_order_line_id_planned_date_line_no_key;

alter table public.smt_production_plans
  add constraint smt_production_plans_order_line_id_planned_date_line_no_key
  unique (order_line_id, planned_date, line_no);

comment on column public.smt_production_plans.order_line_id is '주문 라인 FK (order_lines.id) — 계획 수량의 기준';
comment on table public.smt_production_plans is 'SMT 생산계획 — 주문 라인·일자·SMT 라인별 계획 수량';
