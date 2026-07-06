-- 이미 materials 테이블이 있고 CSV import 시 23502(null) 오류가 날 때 실행하세요.

alter table public.materials alter column customer drop not null;
alter table public.materials alter column specification drop not null;
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials' and column_name = 'process'
  ) then
    alter table public.materials alter column process drop not null;
  end if;
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materials' and column_name = 'type'
  ) then
    alter table public.materials alter column type drop not null;
  end if;
end $$;
alter table public.materials drop constraint if exists materials_process_check;
alter table public.materials alter column cpn drop not null;
alter table public.materials alter column mpn drop not null;
alter table public.materials alter column mpn2 drop not null;
alter table public.materials alter column spn drop not null;
alter table public.materials alter column spn2 drop not null;
alter table public.materials alter column supplier drop not null;
alter table public.materials alter column supply_type drop not null;
alter table public.materials drop constraint if exists materials_supply_type_check;
alter table public.materials alter column moq drop not null;
alter table public.materials alter column unit_price drop not null;

create or replace function public.normalize_materials_row()
returns trigger
language plpgsql
as $$
begin
  new.customer := coalesce(trim(new.customer), '');
  new.material_name := coalesce(trim(new.material_name), '');
  new.specification := coalesce(trim(new.specification), '');
  new.type := coalesce(trim(new.type), '');
  new.cpn := coalesce(trim(new.cpn), '');
  new.mpn := coalesce(trim(new.mpn), '');
  new.mpn2 := coalesce(trim(new.mpn2), '');
  new.spn := coalesce(trim(new.spn), '');
  new.spn2 := coalesce(trim(new.spn2), '');
  new.supplier := coalesce(trim(new.supplier), '');
  new.supply_type := coalesce(trim(new.supply_type), '');
  new.moq := coalesce(new.moq, 0);
  new.unit_price := coalesce(new.unit_price, 0);
  return new;
end;
$$;

drop trigger if exists materials_normalize_row on public.materials;
create trigger materials_normalize_row
  before insert or update on public.materials
  for each row
  execute function public.normalize_materials_row();
