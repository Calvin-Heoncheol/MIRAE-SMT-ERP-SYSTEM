-- Supabase SQL Editor에서 실행하세요
-- orders.id: 고객사 PO/NO 또는 MRO-0001 자동 발급 허용

alter table public.orders drop constraint if exists orders_id_mro_format_check;

alter table public.orders drop constraint if exists orders_id_not_blank_check;
alter table public.orders add constraint orders_id_not_blank_check check (length(trim(id)) > 0);

alter table public.orders drop constraint if exists orders_id_length_check;
alter table public.orders add constraint orders_id_length_check check (char_length(id) <= 100);

comment on column public.orders.id is '주문코드 — 고객사 PO/NO 또는 MRO-0001 (INSERT 시 비어 있으면 자동 발급, 수정 불가)';
