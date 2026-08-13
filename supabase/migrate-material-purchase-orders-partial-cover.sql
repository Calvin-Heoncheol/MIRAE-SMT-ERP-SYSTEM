-- 주문서 부분 발주: 발주서가 어느 주문 라인의 제품 수량을 커버했는지 기록
-- (예: 주문 1000개 중 500개분만 자재 발주)

alter table public.material_purchase_orders
  add column if not exists covered_order_line_id text;

alter table public.material_purchase_orders
  add column if not exists covered_product_quantity numeric
    check (covered_product_quantity is null or covered_product_quantity >= 0);

comment on column public.material_purchase_orders.covered_order_line_id is
  '부분 발주 시 커버한 고객 주문 라인(order_lines.id)';

comment on column public.material_purchase_orders.covered_product_quantity is
  '부분 발주 시 커버한 제품 수량 (주문 수량 중 이번 발주 분)';

create index if not exists material_purchase_orders_covered_line_idx
  on public.material_purchase_orders (covered_order_line_id)
  where covered_order_line_id is not null;
