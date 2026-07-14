-- Supabase SQL Editor에서 실행하세요 (setup-orders.sql, setup-smt-production.sql 이후)
--
-- SMT 생산계획: 주문 라인·면구분·일자·라인 배치

create table if not exists public.smt_production_plans (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  planned_date date not null,
  line_no smallint not null check (line_no >= 1 and line_no <= 7),
  pcb_side text not null default 'SINGLE' check (pcb_side in ('SINGLE', 'TOP', 'BOT')),
  planned_quantity integer not null check (planned_quantity > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (order_line_id, planned_date, line_no, pcb_side)
);

comment on table public.smt_production_plans is 'SMT 생산계획 — 주문 라인·면·일자·SMT 라인별 계획 수량';
comment on column public.smt_production_plans.order_id is '주문서 FK (orders.id)';
comment on column public.smt_production_plans.order_line_id is '주문 라인 FK (order_lines.id) — 계획 수량의 기준';
comment on column public.smt_production_plans.planned_date is '계획일 (KST)';
comment on column public.smt_production_plans.line_no is 'SMT 라인 번호 1~7';
comment on column public.smt_production_plans.pcb_side is '면구분: SINGLE / TOP / BOT (양면 제품은 TOP 또는 BOT)';
comment on column public.smt_production_plans.planned_quantity is '해당 일·라인·면 계획 수량';

create index if not exists smt_production_plans_planned_date_idx
  on public.smt_production_plans (planned_date);

create index if not exists smt_production_plans_order_id_idx
  on public.smt_production_plans (order_id);

create index if not exists smt_production_plans_order_line_id_idx
  on public.smt_production_plans (order_line_id);

alter table public.smt_production_plans enable row level security;

drop policy if exists "smt_production_plans public read" on public.smt_production_plans;
create policy "smt_production_plans public read"
  on public.smt_production_plans for select using (true);

drop policy if exists "smt_production_plans public insert" on public.smt_production_plans;
create policy "smt_production_plans public insert"
  on public.smt_production_plans for insert with check (true);

drop policy if exists "smt_production_plans public update" on public.smt_production_plans;
create policy "smt_production_plans public update"
  on public.smt_production_plans for update using (true) with check (true);

drop policy if exists "smt_production_plans public delete" on public.smt_production_plans;
create policy "smt_production_plans public delete"
  on public.smt_production_plans for delete using (true);
