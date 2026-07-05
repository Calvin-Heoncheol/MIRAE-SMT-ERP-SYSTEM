-- Supabase SQL Editor에서 실행하세요
-- line_seq 컬럼 삭제 전 준비: 뷰 제거 · 유니크 제약 제거 · 뷰 재생성 (line_seq 없음)
--
-- 실행 순서:
--   1) 이 파일 실행
--   2) Table Editor에서 finished_product_bom_items, semi_product_bom_items 의 line_seq 컬럼 삭제

-- 1) 기존 뷰 제거
drop view if exists public.finished_product_bom_detail;
drop view if exists public.semi_product_bom_detail;

-- 2) line_seq 유니크 제약 제거
alter table public.finished_product_bom_items
  drop constraint if exists finished_product_bom_items_parent_line_seq_unique;

alter table public.semi_product_bom_items
  drop constraint if exists semi_product_bom_items_product_line_seq_unique;

-- 3) line_seq 없이 뷰 재생성 (컬럼 삭제 전에도 실행 가능)
create view public.finished_product_bom_detail as
select
  bom.id,
  bom.parent_product_id,
  parent.product_code as parent_product_code,
  parent.product_name as parent_product_name,
  parent.product_kind as parent_product_kind,
  bom.child_product_id,
  child.product_code as child_product_code,
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
  bom.id,
  bom.product_id,
  product.product_code,
  product.product_name,
  product.product_kind,
  bom.material_id,
  mat.material_name,
  mat.cpn,
  mat.mpn,
  mat.process,
  bom.quantity_per,
  bom.ref_designator,
  bom.note
from public.semi_product_bom_items bom
join public.products product on product.id = bom.product_id
join public.materials mat on mat.id = bom.material_id
order by bom.product_id, mat.material_name, bom.ref_designator;

comment on view public.semi_product_bom_detail is '반제품 BOM 상세 (자재명·CPN 포함)';

grant select on public.finished_product_bom_detail to anon, authenticated;
grant select on public.semi_product_bom_detail to anon, authenticated;
