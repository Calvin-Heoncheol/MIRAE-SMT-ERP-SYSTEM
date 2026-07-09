-- Supabase SQL Editor에서 실행하세요
-- materials.cpn 제거 — 자재 식별은 id(MRM-0001)만 사용

-- semi_product_bom_detail 뷰가 materials.cpn 에 의존하므로 먼저 제거
drop view if exists public.semi_product_bom_detail;

drop index if exists public.materials_customer_cpn_unique_idx;
drop index if exists public.materials_cpn_idx;

alter table public.materials drop column if exists cpn;

-- 뷰 재생성 (material_code = materials.id, cpn 컬럼 제거)
create view public.semi_product_bom_detail as
select
  bom.product_id,
  product.id as product_code,
  product.product_name,
  product.product_kind,
  bom.material_id,
  mat.id as material_code,
  mat.material_name,
  mat.mpn,
  mat.type,
  bom.quantity_per,
  bom.ref_designator,
  bom.note
from public.semi_product_bom_items bom
join public.products product on product.id = bom.product_id
join public.materials mat on mat.id = bom.material_id
order by bom.product_id, mat.material_name, bom.ref_designator;

comment on view public.semi_product_bom_detail is '반제품 BOM 상세 (자재코드·자재명·MPN 포함)';

grant select on public.semi_product_bom_detail to anon, authenticated;

-- 발주 라인 스냅샷: cpn 컬럼에 자재 id 복사 (기존 CPN 값 대체)
update public.material_purchase_order_lines as lines
set cpn = materials.id
from public.materials as materials
where lines.material_id = materials.id
  and trim(coalesce(lines.cpn, '')) <> materials.id;

create or replace function public.normalize_materials_row()
returns trigger
language plpgsql
as $$
begin
  new.customer := coalesce(trim(new.customer), '');
  new.material_name := coalesce(trim(new.material_name), '');
  new.specification := coalesce(trim(new.specification), '');
  new.type := coalesce(trim(new.type), '');
  new.mpn := coalesce(trim(new.mpn), '');
  new.supplier := coalesce(trim(new.supplier), '');
  new.supply_type := coalesce(trim(new.supply_type), '');
  new.moq := coalesce(new.moq, 0);
  new.unit_price := coalesce(new.unit_price, 0);
  return new;
end;
$$;

comment on table public.materials is '자재등록 마스터 — 자재코드=id (INSERT 시 직접 입력)';
comment on column public.material_purchase_order_lines.cpn is '자재코드 스냅샷 (materials.id)';
