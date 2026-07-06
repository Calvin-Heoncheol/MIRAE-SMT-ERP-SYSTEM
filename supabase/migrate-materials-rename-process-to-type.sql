-- Supabase SQL Editor에서 실행하세요
-- materials.process → materials.type 컬럼명 변경

drop view if exists public.semi_product_bom_detail;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'materials'
      and column_name = 'process'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'materials'
      and column_name = 'type'
  ) then
    alter table public.materials rename column process to type;
  end if;
end $$;

comment on column public.materials.type is '자재 구분 (SMD / DIP)';

create or replace function public.normalize_materials_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_material_code();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.customer := coalesce(trim(new.customer), '');
  new.material_name := coalesce(trim(new.material_name), '');
  new.specification := coalesce(trim(new.specification), '');
  new.type := coalesce(trim(new.type), '');
  new.cpn := coalesce(trim(new.cpn), '');
  new.mpn := coalesce(trim(new.mpn), '');
  new.supplier := coalesce(trim(new.supplier), '');
  new.supply_type := coalesce(trim(new.supply_type), '');
  new.moq := coalesce(new.moq, 0);
  new.unit_price := coalesce(new.unit_price, 0);
  return new;
end;
$$;

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

comment on view public.semi_product_bom_detail is '반제품 BOM 상세 (자재명·CPN·기본 MPN 포함)';
