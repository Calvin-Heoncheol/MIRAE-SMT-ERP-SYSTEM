-- BOM Excel/스마트 등록용 컬럼
-- Supabase SQL Editor에서 실행하세요.

alter table public.bom_items
  add column if not exists process text not null default '';

alter table public.bom_items
  add column if not exists designators text not null default '';

alter table public.bom_items
  add column if not exists source_mpn text not null default '';

alter table public.bom_items
  add column if not exists source_part_code text not null default '';

alter table public.bom_items
  add column if not exists source_name text not null default '';

alter table public.bom_items
  add column if not exists source_spec text not null default '';

alter table public.bom_items
  drop constraint if exists bom_items_process_check;

alter table public.bom_items
  add constraint bom_items_process_check
  check (process in ('', 'smd', 'dip'));

comment on column public.bom_items.process is '공정 — smd | dip (Excel 공정 열)';
comment on column public.bom_items.designators is 'Designator 목록 (예: C1,C2,C3)';
comment on column public.bom_items.source_mpn is '등록 시 Excel MPN 스냅샷';
comment on column public.bom_items.source_part_code is '등록 시 Excel 품목코드 스냅샷';
comment on column public.bom_items.source_name is '등록 시 Excel 품목명 스냅샷';
comment on column public.bom_items.source_spec is '등록 시 Excel 규격 스냅샷';

-- 조회 뷰 갱신
drop view if exists public.bom_detail;

create view public.bom_detail as
select
  bom.parent_product_id,
  parent.name as parent_product_name,
  parent.item_category as parent_item_category,
  bom.child_product_id,
  child.name as child_product_name,
  child.item_category as child_item_category,
  child.mpn as child_mpn,
  child.pcb_side_mode as child_pcb_side_mode,
  bom.quantity_per,
  bom.note,
  bom.process,
  bom.designators,
  bom.source_mpn,
  bom.source_part_code,
  bom.source_name,
  bom.source_spec
from public.bom_items bom
join public.items parent on parent.id = bom.parent_product_id
join public.items child on child.id = bom.child_product_id
order by bom.parent_product_id, child.name;

comment on view public.bom_detail is 'BOM 상세 (부모·자식·Excel 스냅샷 포함)';
