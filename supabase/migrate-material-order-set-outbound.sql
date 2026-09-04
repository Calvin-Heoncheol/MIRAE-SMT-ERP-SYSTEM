-- 발주(세트) 단위 수동 자재 출고 이력 — 자재 입고 및 출고 메뉴용
create table if not exists public.material_order_set_outbound_logs (
  id uuid primary key default gen_random_uuid(),
  order_id text not null,
  order_line_id text not null,
  record_date date not null,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  created_by_name text not null default ''
);

create index if not exists material_order_set_outbound_line_idx
  on public.material_order_set_outbound_logs (order_line_id);

create index if not exists material_order_set_outbound_order_idx
  on public.material_order_set_outbound_logs (order_id);

comment on table public.material_order_set_outbound_logs is
  '발주 세트 단위 수동 자재 출고 누적 (자재 입고 및 출고)';

alter table public.material_order_set_outbound_logs enable row level security;

drop policy if exists material_order_set_outbound_select on public.material_order_set_outbound_logs;
create policy material_order_set_outbound_select
  on public.material_order_set_outbound_logs for select
  to authenticated using (true);

drop policy if exists material_order_set_outbound_insert on public.material_order_set_outbound_logs;
create policy material_order_set_outbound_insert
  on public.material_order_set_outbound_logs for insert
  to authenticated with check (true);
