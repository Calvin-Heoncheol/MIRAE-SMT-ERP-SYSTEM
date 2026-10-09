-- 발주 라인별 자재 예상입고일 — 입고 및 불출 메뉴용
create table if not exists public.material_order_expected_inbound (
  order_line_id text primary key,
  order_id text not null,
  expected_date date not null,
  updated_at timestamptz not null default now(),
  updated_by_name text not null default ''
);

create index if not exists material_order_expected_inbound_order_idx
  on public.material_order_expected_inbound (order_id);

comment on table public.material_order_expected_inbound is
  '발주 라인별 자재 예상입고일 (입고 및 불출)';

alter table public.material_order_expected_inbound enable row level security;

drop policy if exists material_order_expected_inbound_select on public.material_order_expected_inbound;
create policy material_order_expected_inbound_select
  on public.material_order_expected_inbound for select
  to authenticated using (true);

drop policy if exists material_order_expected_inbound_insert on public.material_order_expected_inbound;
create policy material_order_expected_inbound_insert
  on public.material_order_expected_inbound for insert
  to authenticated with check (true);

drop policy if exists material_order_expected_inbound_update on public.material_order_expected_inbound;
create policy material_order_expected_inbound_update
  on public.material_order_expected_inbound for update
  to authenticated using (true) with check (true);

drop policy if exists material_order_expected_inbound_delete on public.material_order_expected_inbound;
create policy material_order_expected_inbound_delete
  on public.material_order_expected_inbound for delete
  to authenticated using (true);
