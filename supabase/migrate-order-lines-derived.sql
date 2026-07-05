-- Supabase SQL Editor에서 실행하세요 (setup-products.sql 이후)
-- 완제품(p60A) 단독 주문 → SMT용 BOM 펼침 줄

alter table public.order_lines
  add column if not exists derived_from_line_id uuid references public.order_lines(id) on delete cascade;

comment on column public.order_lines.derived_from_line_id is '완제품 주문 줄에서 BOM 펼침으로 생성된 반제품 줄 (주문 UI 비표시)';

create unique index if not exists order_lines_derived_parent_product_unique_idx
  on public.order_lines (derived_from_line_id, product_id)
  where derived_from_line_id is not null;
