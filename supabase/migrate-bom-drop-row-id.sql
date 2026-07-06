-- Supabase SQL Editor에서 실행하세요
-- BOM 라인 테이블: 별도 uuid id 제거 → 복합 PK 로 전환
--
-- finished_product_bom_items PK: (parent_product_id, child_product_id)
-- semi_product_bom_items     PK: (product_id, material_id, ref_designator)
--
-- [주의] semi_product_bom 에 (product_id, material_id, ref_designator) 중복 행이 있으면
--        PK 추가 전에 중복을 정리해야 합니다.

drop view if exists public.order_assembly_group_detail;
drop view if exists public.semi_product_bom_detail;
drop view if exists public.finished_product_bom_detail;

-- ---------------------------------------------------------------------------
-- finished_product_bom_items
-- ---------------------------------------------------------------------------

alter table public.finished_product_bom_items
  drop constraint if exists finished_product_bom_items_parent_child_unique;

alter table public.finished_product_bom_items
  drop constraint if exists finished_product_bom_items_pkey;

alter table public.finished_product_bom_items
  drop column if exists id;

alter table public.finished_product_bom_items
  add primary key (parent_product_id, child_product_id);

-- ---------------------------------------------------------------------------
-- semi_product_bom_items
-- ---------------------------------------------------------------------------

drop index if exists public.semi_product_bom_items_product_ref_unique_idx;

alter table public.semi_product_bom_items
  drop constraint if exists semi_product_bom_items_pkey;

alter table public.semi_product_bom_items
  drop column if exists id;

alter table public.semi_product_bom_items
  add primary key (product_id, material_id, ref_designator);

-- ---------------------------------------------------------------------------
-- 뷰 재생성 (setup-bom.sql 과 동일)
-- ---------------------------------------------------------------------------

create view public.finished_product_bom_detail as
select
  bom.parent_product_id,
  parent.id as parent_product_code,
  parent.product_name as parent_product_name,
  parent.product_kind as parent_product_kind,
  bom.child_product_id,
  child.id as child_product_code,
  child.product_name as child_product_name,
  child.product_kind as child_product_kind,
  child.pcb_side_mode as child_pcb_side_mode,
  bom.quantity_per,
  bom.note
from public.finished_product_bom_items bom
join public.products parent on parent.id = bom.parent_product_id
join public.products child on child.id = bom.child_product_id
order by bom.parent_product_id, child.product_name;

comment on view public.finished_product_bom_detail is '완제품 BOM 상세 (제품명 포함)';

create view public.semi_product_bom_detail as
select
  bom.product_id,
  product.id as product_code,
  product.product_name,
  product.product_kind,
  bom.material_id,
  mat.id as material_code,
  mat.material_name,
  mat.cpn,
  mat.mpn,
  mat.type,
  bom.quantity_per,
  bom.ref_designator,
  bom.note
from public.semi_product_bom_items bom
join public.products product on product.id = bom.product_id
join public.materials mat on mat.id = bom.material_id
order by bom.product_id, mat.material_name, bom.ref_designator;

comment on view public.semi_product_bom_detail is '반제품 BOM 상세 (자재명·CPN 포함)';

create view public.order_assembly_group_detail as
select
  grp.id as assembly_group_id,
  grp.order_id,
  ord.id as order_number,
  grp.parent_product_id,
  parent.id as parent_product_code,
  parent.product_name as parent_product_name,
  grp.target_quantity,
  grp.group_seq,
  line.id as group_line_id,
  line.order_line_id,
  ol.line_seq as order_line_seq,
  line.child_product_id,
  child.id as child_product_code,
  child.product_name as child_product_name,
  ol.quantity as order_line_quantity,
  line.quantity_per
from public.order_assembly_groups grp
join public.orders ord on ord.id = grp.order_id
join public.products parent on parent.id = grp.parent_product_id
left join public.order_assembly_group_lines line on line.assembly_group_id = grp.id
left join public.order_lines ol on ol.id = line.order_line_id
left join public.products child on child.id = line.child_product_id
order by grp.order_id, grp.group_seq, ol.line_seq;

comment on view public.order_assembly_group_detail is '주문 조립 세트 상세 (라인·반제품 포함)';

grant select on public.finished_product_bom_detail to anon, authenticated;
grant select on public.semi_product_bom_detail to anon, authenticated;
grant select on public.order_assembly_group_detail to anon, authenticated;
