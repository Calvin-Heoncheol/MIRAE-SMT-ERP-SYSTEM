-- Supabase SQL Editor에서 실행하세요
-- 생산계획 달력 일정 — 자재 입고예정·입고검사, 영업 출하
-- (자재 입고·SMD·후공정은 기존 production_plan_board_items / smt·후공정 계획 테이블 사용)

create table if not exists public.production_plan_events (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('material_expected', 'material_inspection', 'shipping')),
  order_id text not null references public.orders (id) on delete cascade,
  order_line_id uuid not null references public.order_lines (id) on delete cascade,
  planned_date date not null,
  planned_end_date date,
  planned_quantity integer check (planned_quantity is null or planned_quantity > 0),
  order_number text not null default '',
  customer_po_number text not null default '',
  customer text not null default '',
  product_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default ''
);

create index if not exists production_plan_events_date_idx
  on public.production_plan_events (planned_date);

create index if not exists production_plan_events_line_idx
  on public.production_plan_events (order_line_id);

comment on table public.production_plan_events is
  '생산계획 달력 일정 — 입고예정(material_expected)·입고검사(material_inspection)·출하(shipping)';

alter table public.production_plan_events enable row level security;

drop policy if exists production_plan_events_select on public.production_plan_events;
create policy production_plan_events_select
  on public.production_plan_events for select
  using (true);

drop policy if exists production_plan_events_insert on public.production_plan_events;
create policy production_plan_events_insert
  on public.production_plan_events for insert
  to authenticated
  with check (true);

drop policy if exists production_plan_events_update on public.production_plan_events;
create policy production_plan_events_update
  on public.production_plan_events for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists production_plan_events_delete on public.production_plan_events;
create policy production_plan_events_delete
  on public.production_plan_events for delete
  to authenticated
  using (true);
