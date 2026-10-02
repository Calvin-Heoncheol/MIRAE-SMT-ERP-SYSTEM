-- BOM 줄별 대체자재 (품목코드가 다른 대체 품목)
-- Supabase SQL Editor에서 실행하세요.

alter table public.bom_items
  add column if not exists source_alternates text not null default '';

alter table public.bom_items
  add column if not exists alternate_child_product_ids text[] not null default '{}';

comment on column public.bom_items.source_alternates is '대체 열 원문 스냅샷 (예: C1608-104K-B, GRM188R71C104KA01D)';
comment on column public.bom_items.alternate_child_product_ids is '이 BOM 줄에서 주자재 대신 쓸 수 있는 품목 items.id 목록';

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
  bom.source_spec,
  bom.source_alternates,
  bom.alternate_child_product_ids
from public.bom_items bom
join public.items parent on parent.id = bom.parent_product_id
join public.items child on child.id = bom.child_product_id
order by bom.parent_product_id, child.name;

comment on view public.bom_detail is 'BOM 상세 (부모·자식·Excel 스냅샷·대체자재 포함)';
