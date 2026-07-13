-- bom_detail / order_assembly_group_detail 뷰에서
-- items.id 와 중복되는 *_product_code 컬럼 제거
-- (items.id 자체가 품목코드이므로 parent/child_product_id 만 사용)

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
  bom.note
from public.bom_items bom
join public.items parent on parent.id = bom.parent_product_id
join public.items child on child.id = bom.child_product_id
order by bom.parent_product_id, child.name;

comment on view public.bom_detail is 'BOM 상세 (부모·자식 품목명·구분 포함)';

drop view if exists public.order_assembly_group_detail;

create view public.order_assembly_group_detail as
select
  grp.id as assembly_group_id,
  grp.order_id,
  ord.id as order_number,
  grp.parent_product_id,
  parent.name as parent_product_name,
  grp.target_quantity,
  grp.group_seq,
  line.id as group_line_id,
  line.order_line_id,
  ol.line_seq as order_line_seq,
  line.child_product_id,
  child.name as child_product_name,
  ol.quantity as order_line_quantity,
  line.quantity_per
from public.order_assembly_groups grp
join public.orders ord on ord.id = grp.order_id
join public.items parent on parent.id = grp.parent_product_id
left join public.order_assembly_group_lines line on line.assembly_group_id = grp.id
left join public.order_lines ol on ol.id = line.order_line_id
left join public.items child on child.id = line.child_product_id
order by grp.order_id, grp.group_seq, ol.line_seq;

comment on view public.order_assembly_group_detail is '주문 조립 세트 상세 (라인·반제품 포함)';

grant select on public.bom_detail to anon, authenticated;
grant select on public.order_assembly_group_detail to anon, authenticated;
