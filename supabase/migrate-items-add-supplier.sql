-- 품목등록: 공급사(supplier) 컬럼 추가
-- Supabase SQL Editor에서 실행

alter table public.items
  add column if not exists supplier text not null default '';

comment on column public.items.supplier is '공급사 — 원자재·부자재';

create index if not exists items_supplier_idx on public.items (supplier);
