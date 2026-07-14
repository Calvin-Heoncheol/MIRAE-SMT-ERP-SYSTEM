-- Supabase SQL Editor에서 실행하세요
-- 자재 발주 「주문서」카드만 삭제 (고객 주문은 유지)

create table if not exists public.material_purchase_need_deleted_orders (
  order_id text primary key references public.orders(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

comment on table public.material_purchase_need_deleted_orders is
  '자재 발주 화면 주문서 카드 삭제 목록 — 고객 주문(orders)은 삭제하지 않음';

create index if not exists material_purchase_need_deleted_orders_deleted_at_idx
  on public.material_purchase_need_deleted_orders (deleted_at desc);

alter table public.material_purchase_need_deleted_orders enable row level security;

drop policy if exists "material_purchase_need_deleted_orders public read"
  on public.material_purchase_need_deleted_orders;
create policy "material_purchase_need_deleted_orders public read"
  on public.material_purchase_need_deleted_orders for select using (true);

drop policy if exists "material_purchase_need_deleted_orders public insert"
  on public.material_purchase_need_deleted_orders;
create policy "material_purchase_need_deleted_orders public insert"
  on public.material_purchase_need_deleted_orders for insert with check (true);

drop policy if exists "material_purchase_need_deleted_orders public delete"
  on public.material_purchase_need_deleted_orders;
create policy "material_purchase_need_deleted_orders public delete"
  on public.material_purchase_need_deleted_orders for delete using (true);
