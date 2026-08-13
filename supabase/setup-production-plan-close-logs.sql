-- Supabase SQL Editor에서 실행하세요 (setup-smt-production-plans.sql, setup-post-process-production-plans.sql 이후)
--
-- 생산계획 자동 마감 로그: 지난 날짜의 미완료 계획을 마감(수량 조정/삭제)할 때
-- 원래 계획 수량을 보존해 리포트에서 "계획 달성률"을 계산할 수 있게 한다.

create table if not exists public.production_plan_close_logs (
  id uuid primary key default gen_random_uuid(),
  module text not null check (module in ('smt', 'post_process')),
  planned_date date not null,
  -- 후공정 팀 (생산2팀/생산3팀/생산4팀). SMT는 빈 값 = 생산1팀
  team text not null default '',
  order_id text not null default '',
  -- 마감 전 원래 계획 수량
  original_quantity integer not null check (original_quantity > 0),
  -- 마감 시점까지의 실적 수량 (0이면 계획 삭제됨)
  produced_quantity integer not null default 0,
  closed_at timestamptz not null default now()
);

comment on table public.production_plan_close_logs is '생산계획 자동 마감 로그 — 원계획 수량 보존 (달성률 계산용)';
comment on column public.production_plan_close_logs.module is 'smt | post_process';
comment on column public.production_plan_close_logs.team is '후공정 팀명. SMT는 빈 값 (생산1팀)';
comment on column public.production_plan_close_logs.original_quantity is '마감 전 계획 수량';
comment on column public.production_plan_close_logs.produced_quantity is '마감 시점 실적 수량';

create index if not exists production_plan_close_logs_planned_date_idx
  on public.production_plan_close_logs (module, planned_date);

alter table public.production_plan_close_logs enable row level security;

drop policy if exists "production_plan_close_logs public read" on public.production_plan_close_logs;
create policy "production_plan_close_logs public read"
  on public.production_plan_close_logs for select using (true);

drop policy if exists "production_plan_close_logs public insert" on public.production_plan_close_logs;
create policy "production_plan_close_logs public insert"
  on public.production_plan_close_logs for insert with check (true);
