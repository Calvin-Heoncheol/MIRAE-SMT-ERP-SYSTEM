-- Supabase SQL Editor에서 실행하세요
-- materials.id 자동발급(MRM-0001) 제거 — INSERT 시 id 직접 입력 필수

alter table public.materials
  drop constraint if exists materials_id_mrm_format_check;

alter table public.materials
  drop constraint if exists materials_id_not_blank_check;

alter table public.materials
  add constraint materials_id_not_blank_check check (length(trim(id)) > 0);

drop function if exists public.generate_material_code() cascade;

create or replace function public.normalize_materials_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(trim(new.id), '');
    if new.id = '' then
      raise exception 'materials.id 는 INSERT 시 필수입니다.';
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

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
comment on column public.materials.id is '자재코드 (INSERT 시 필수, 수정 불가)';
