-- Supabase SQL Editor에서 실행하세요
-- (setup-orders.sql, setup-bom.sql / order_assembly_groups 이후)
--
-- 생산계획 보드: 확정된 주문라인(SMT)·조립그룹(후공정) + 일정 배정 컬럼

create table if not exists public.production_plan_board_items (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('smt', 'post')),
  order_id text not null references public.orders (id) on delete cascade,
  order_line_id uuid references public.order_lines (id) on delete cascade,
  assembly_group_id uuid references public.order_assembly_groups (id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed')),
  planned_date date,
  line_no smallint check (line_no is null or (line_no >= 1 and line_no <= 7)),
  team text,
  pcb_side text not null default 'SINGLE' check (pcb_side in ('SINGLE', 'TOP', 'BOT', 'BOTH')),
  planned_quantity integer check (planned_quantity is null or planned_quantity > 0),
  confirmed_at timestamptz not null default now(),
  confirmed_by uuid references auth.users (id) on delete set null,
  confirmed_by_name text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint production_plan_board_scope_ref check (
    (scope = 'smt' and order_line_id is not null and assembly_group_id is null)
    or (scope = 'post' and assembly_group_id is not null and order_line_id is null)
  )
);

create unique index if not exists production_plan_board_smt_line_uidx
  on public.production_plan_board_items (order_line_id)
  where scope = 'smt' and order_line_id is not null;

create unique index if not exists production_plan_board_post_group_uidx
  on public.production_plan_board_items (assembly_group_id)
  where scope = 'post' and assembly_group_id is not null;

create index if not exists production_plan_board_order_id_idx
  on public.production_plan_board_items (order_id);

create index if not exists production_plan_board_scope_status_idx
  on public.production_plan_board_items (scope, status);

comment on table public.production_plan_board_items is
  '생산계획 보드 — 확정된 주문라인(SMT)·조립그룹(후공정). 미확정은 행 없음.';
comment on column public.production_plan_board_items.planned_date is '확정 계획일 (KST)';
comment on column public.production_plan_board_items.line_no is 'SMT 라인 1~7 (scope=smt)';
comment on column public.production_plan_board_items.team is '후공정 팀 (scope=post)';
comment on column public.production_plan_board_items.pcb_side is 'SINGLE | TOP | BOT | BOTH(양면 동시)';
comment on column public.production_plan_board_items.planned_quantity is '확정 계획 수량';

-- 기존 DB 보강 (migrate-production-plan-board-schedule 대응)
alter table public.production_plan_board_items
  add column if not exists planned_date date;
alter table public.production_plan_board_items
  add column if not exists line_no smallint;
alter table public.production_plan_board_items
  add column if not exists team text;
alter table public.production_plan_board_items
  add column if not exists pcb_side text not null default 'SINGLE';
alter table public.production_plan_board_items
  add column if not exists planned_quantity integer;

alter table public.production_plan_board_items
  drop constraint if exists production_plan_board_items_line_no_check;
alter table public.production_plan_board_items
  add constraint production_plan_board_items_line_no_check
  check (line_no is null or (line_no >= 1 and line_no <= 7));

alter table public.production_plan_board_items
  drop constraint if exists production_plan_board_items_pcb_side_check;
alter table public.production_plan_board_items
  add constraint production_plan_board_items_pcb_side_check
  check (pcb_side in ('SINGLE', 'TOP', 'BOT', 'BOTH'));

alter table public.production_plan_board_items
  drop constraint if exists production_plan_board_items_planned_quantity_check;
alter table public.production_plan_board_items
  add constraint production_plan_board_items_planned_quantity_check
  check (planned_quantity is null or planned_quantity > 0);

alter table public.production_plan_board_items enable row level security;

drop policy if exists production_plan_board_select on public.production_plan_board_items;
create policy production_plan_board_select
  on public.production_plan_board_items for select
  to anon, authenticated
  using (true);

drop policy if exists production_plan_board_insert on public.production_plan_board_items;
create policy production_plan_board_insert
  on public.production_plan_board_items for insert
  to authenticated
  with check (true);

drop policy if exists production_plan_board_update on public.production_plan_board_items;
create policy production_plan_board_update
  on public.production_plan_board_items for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists production_plan_board_delete on public.production_plan_board_items;
create policy production_plan_board_delete
  on public.production_plan_board_items for delete
  to authenticated
  using (true);
