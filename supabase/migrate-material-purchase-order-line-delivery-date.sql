-- 자재 발주 라인별 납기일
-- Supabase SQL Editor에서 실행하세요.

alter table public.material_purchase_order_lines
  add column if not exists delivery_date date;

comment on column public.material_purchase_order_lines.delivery_date is
  '자재(라인)별 공급사 납기 예정일';

create index if not exists material_purchase_order_lines_delivery_date_idx
  on public.material_purchase_order_lines (delivery_date);
