-- 반제품 기타 단가 컬럼 + unit_price = SMD+DIP+자재+기타 합산 트리거 갱신

alter table public.items
  add column if not exists other_unit_price numeric not null default 0;

alter table public.items
  drop constraint if exists items_other_unit_price_check;

comment on column public.items.other_unit_price is '기타 단가 — 반제품(3), 음수(할인·조정) 허용';

create or replace function public.normalize_items_row()
returns trigger
language plpgsql
as $$
begin
  new.id := upper(trim(coalesce(new.id, '')));
  if new.id = '' then
    raise exception '품목코드는 필수입니다.';
  end if;

  new.name := trim(coalesce(new.name, ''));
  if new.name = '' then
    raise exception '품목명은 필수입니다.';
  end if;

  new.base_code := upper(trim(coalesce(nullif(trim(coalesce(new.base_code, '')), ''), new.id)));
  new.version := coalesce(trim(new.version), '');

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

  new.other_unit_price := coalesce(new.other_unit_price, 0);

  new.unit_price := coalesce(new.unit_price, 0);
  if new.item_category is distinct from 3 and new.unit_price < 0 then
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
    new.smd_unit_price := 0;
    new.dip_unit_price := 0;
    new.material_unit_price := 0;
    new.other_unit_price := 0;
  else
    new.unit_price :=
      new.smd_unit_price
      + new.dip_unit_price
      + new.material_unit_price
      + new.other_unit_price;
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
