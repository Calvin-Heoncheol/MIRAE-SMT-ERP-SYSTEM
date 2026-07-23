-- 품목 안전재고 (원자재·부자재·반제품·완제품 공통)
-- Supabase SQL Editor에서 실행하세요.

alter table public.items
  add column if not exists safety_stock integer not null default 0;

alter table public.items
  drop constraint if exists items_safety_stock_check;

alter table public.items
  add constraint items_safety_stock_check check (safety_stock >= 0);

comment on column public.items.safety_stock is '안전재고(최소 보유 수량). 현재고가 이보다 작으면 미달';
