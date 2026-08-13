-- 주문서 비고 (orders.note)
alter table public.orders
  add column if not exists note text not null default '';

comment on column public.orders.note is '주문서 비고';

-- 이전에 품목 줄 비고를 추가했다면 제거 (선택)
alter table public.order_lines
  drop column if exists note;
