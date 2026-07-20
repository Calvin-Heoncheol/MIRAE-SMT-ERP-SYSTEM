-- Supabase SQL Editor에서 실행하세요 (setup-items.sql 이후)
-- 반제품(item_category=3) 공정: SMD / 후공정 / SMD+후공정

alter table public.items
  add column if not exists process_type text not null default '';

comment on column public.items.process_type is '공정 — 반제품(3)만: smt=SMD, post=후공정, smt_post=SMD+후공정';

create index if not exists items_process_type_idx
  on public.items (process_type)
  where process_type <> '';

-- 체크 제약 (기존 테이블에 없으면 추가)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'items_process_type_check'
  ) then
    alter table public.items
      add constraint items_process_type_check
      check (process_type in ('', 'smt', 'post', 'smt_post'));
  end if;
end $$;

-- normalize 트리거에서 공정 정규화 반영
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

  new.unit_price := coalesce(new.unit_price, 0);
  if new.unit_price < 0 then
    new.unit_price := 0;
  end if;

  if new.item_category is null or new.item_category not in (1, 2, 3, 4) then
    raise exception '품목구분(1~4)은 필수입니다.';
  end if;

  new.pcb_side_mode := lower(coalesce(trim(new.pcb_side_mode), ''));
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
  end if;

  return new;
end;
$$;
