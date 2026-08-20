-- 불출 전표를 발주 안 제품에 연결. 공용 자재도 제품별로 소요·지급을 나눔.
-- Supabase SQL Editor에서 실행하세요.

alter table public.material_outbound_records
  add column if not exists product_id text;

comment on column public.material_outbound_records.product_id is '생산 지급/잔량반납 시 발주 라인 제품(items.id)';

create index if not exists material_outbound_records_product_id_idx
  on public.material_outbound_records (product_id)
  where product_id is not null;
