-- 주문 라인별 납기일
-- 기존 행은 주문 헤더 납기로 백필

alter table public.order_lines
  add column if not exists delivery_date date;

comment on column public.order_lines.delivery_date is '제품(라인)별 납기일';

update public.order_lines as line
set delivery_date = orders.delivery_date
from public.orders
where line.order_id = orders.id
  and line.delivery_date is null
  and orders.delivery_date is not null;
