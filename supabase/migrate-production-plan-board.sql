-- 생산계획 보드: 대기/확정 (라인·일자 배정 없이 확정만)
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.production_plan_board_items (
  id uuid primary key default gen_random_uuid(),
  scope text not null check (scope in ('smt', 'post')),
  order_id text not null references public.orders (id) on delete cascade,
  order_line_id uuid references public.order_lines (id) on delete cascade,
  assembly_group_id uuid references public.order_assembly_groups (id) on delete cascade,
  status text not null default 'confirmed' check (status in ('confirmed')),
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
