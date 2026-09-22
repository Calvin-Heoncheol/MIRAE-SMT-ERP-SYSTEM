-- 발주서 부가세(VAT) 포함 표시 여부
-- Supabase SQL Editor에서 실행하세요.

alter table public.orders
  add column if not exists include_vat boolean not null default false;

comment on column public.orders.include_vat is '발주서 PDF 등에서 부가세(10%) 포함 표시 여부';
