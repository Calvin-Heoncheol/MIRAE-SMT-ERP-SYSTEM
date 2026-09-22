-- 구매발주 운송비 (헤더 1회)
-- Supabase SQL Editor에서 실행하세요.

alter table public.material_purchase_orders
  add column if not exists freight_amount numeric not null default 0
  check (freight_amount >= 0);

comment on column public.material_purchase_orders.freight_amount is
  '운송비(배송비) — 품목 공급가액과 별도, 발주 합계에 가산';
