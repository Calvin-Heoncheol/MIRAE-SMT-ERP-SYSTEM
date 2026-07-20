-- 면 구분: dual(구 양면) → double, duo(듀얼) 추가
-- Supabase SQL Editor에서 실행하세요

-- 1) check 제약 먼저 제거 (dual만 허용이면 double로 update 불가)
do $$
declare
  constraint_name text;
begin
  select con.conname
  into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'items'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%pcb_side_mode%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.items drop constraint %I', constraint_name);
  end if;
end $$;

-- 2) 기존 양면 데이터 이전 (dual → double)
update public.items
set pcb_side_mode = 'double'
where lower(trim(pcb_side_mode)) = 'dual';

-- 3) 새 check 제약
alter table public.items
  drop constraint if exists items_pcb_side_mode_check;

alter table public.items
  add constraint items_pcb_side_mode_check
  check (pcb_side_mode in ('', 'single', 'duo', 'double'));

comment on column public.items.pcb_side_mode is
  '면 구분 — 단면(single)/듀얼(duo)/양면(double) — 반제품(3)만 사용';

-- 3) normalize 트리거 함수 갱신
create or replace function public.normalize_items_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(trim(new.id), '');
    if new.id = '' then
      raise exception '품목코드는 필수입니다.';
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.name := coalesce(trim(new.name), '');
  if new.name = '' then
    raise exception '품목명은 필수입니다.';
  end if;

  new.specification := coalesce(trim(new.specification), '');
  new.mpn := coalesce(trim(new.mpn), '');

  new.material_type := upper(coalesce(trim(new.material_type), ''));
  if new.material_type not in ('', 'SMD', 'DIP') then
    new.material_type := '';
  end if;

  new.supply_type := coalesce(trim(new.supply_type), '');
  if new.supply_type not in ('', '도급', '사급') then
    new.supply_type := '';
  end if;

  new.smd_unit_price := coalesce(new.smd_unit_price, 0);
  if new.smd_unit_price < 0 then
    new.smd_unit_price := 0;
  end if;

  new.dip_unit_price := coalesce(new.dip_unit_price, 0);
  if new.dip_unit_price < 0 then
    new.dip_unit_price := 0;
  end if;

  new.material_unit_price := coalesce(new.material_unit_price, 0);
  if new.material_unit_price < 0 then
    new.material_unit_price := 0;
  end if;

  new.unit_price := coalesce(new.unit_price, 0);
  if new.unit_price < 0 then
    new.unit_price := 0;
  end if;

  if new.item_category is null or new.item_category not in (1, 2, 3, 4) then
    raise exception '품목구분(1~4)은 필수입니다.';
  end if;

  new.pcb_side_mode := lower(coalesce(trim(new.pcb_side_mode), ''));
  -- 레거시 dual(양면) → double
  if new.pcb_side_mode = 'dual' then
    new.pcb_side_mode := 'double';
  end if;
  if new.pcb_side_mode not in ('', 'single', 'duo', 'double') then
    new.pcb_side_mode := '';
  end if;
  if new.item_category <> 3 then
    new.pcb_side_mode := '';
  end if;

  new.process_type := lower(coalesce(trim(new.process_type), ''));
  if new.process_type not in ('', 'smt', 'post', 'smt_post') then
    new.process_type := '';
  end if;
  if new.item_category <> 3 then
    new.process_type := '';
    new.smd_unit_price := 0;
    new.dip_unit_price := 0;
    new.material_unit_price := 0;
  else
    new.unit_price := new.smd_unit_price + new.dip_unit_price + new.material_unit_price;
    -- 공정은 SMD/DIP 단가 > 0 여부로 자동 판별
    if new.smd_unit_price > 0 and new.dip_unit_price > 0 then
      new.process_type := 'smt_post';
    elsif new.smd_unit_price > 0 then
      new.process_type := 'smt';
    elsif new.dip_unit_price > 0 then
      new.process_type := 'post';
    else
      new.process_type := '';
    end if;
  end if;

  return new;
end;
$$;
