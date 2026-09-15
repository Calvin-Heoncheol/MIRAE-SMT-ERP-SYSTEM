-- 구매발주 통화 (KRW / USD)
-- Supabase SQL Editor에서 실행하세요.

alter table public.material_purchase_orders
  add column if not exists currency text not null default 'KRW';

update public.material_purchase_orders
set currency = 'KRW'
where currency is null
   or trim(currency) = ''
   or upper(trim(currency)) not in ('KRW', 'USD');

update public.material_purchase_orders
set currency = upper(trim(currency));

alter table public.material_purchase_orders
  drop constraint if exists material_purchase_orders_currency_check;

alter table public.material_purchase_orders
  add constraint material_purchase_orders_currency_check
  check (currency in ('KRW', 'USD'));

comment on column public.material_purchase_orders.currency is '구매발주 통화 KRW(원) / USD(달러)';
