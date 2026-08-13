-- 자재 발주서에 고객 주문서 연결 컬럼 추가
-- 주문서 카드에서 발주 시 자동으로 연결되어, 카드의 발주대기/부분발주/발주완료 상태 판정에 사용됩니다.

alter table public.material_purchase_orders
  add column if not exists source_order_id text references public.orders(id) on delete set null;

comment on column public.material_purchase_orders.source_order_id is
  '연결된 고객 주문서(orders.id) — 주문서 카드에서 발주 시 자동 연결';

create index if not exists material_purchase_orders_source_order_idx
  on public.material_purchase_orders (source_order_id);
