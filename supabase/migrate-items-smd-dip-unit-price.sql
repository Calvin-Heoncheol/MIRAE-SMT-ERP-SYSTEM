-- 반제품 단가: SMD / DIP / 자재 세부 + 합계(unit_price)

alter table public.items
  add column if not exists smd_unit_price numeric not null default 0;

alter table public.items
  add column if not exists dip_unit_price numeric not null default 0;

alter table public.items
  add column if not exists material_unit_price numeric not null default 0;

comment on column public.items.smd_unit_price is 'SMD 단가 — 반제품(3)';
comment on column public.items.dip_unit_price is 'DIP 단가 — 반제품(3)';
comment on column public.items.material_unit_price is '자재 단가 — 반제품(3)';
comment on column public.items.unit_price is '단가 (반제품은 SMD+DIP+자재 합계)';

-- 기존 반제품 단가 → 공정에 맞춰 배분 (세부 단가가 아직 비어 있는 경우만)
update public.items
set
  smd_unit_price = case
    when process_type = 'post' then 0
    else coalesce(unit_price, 0)
  end,
  dip_unit_price = case
    when process_type = 'post' then coalesce(unit_price, 0)
    else 0
  end,
  material_unit_price = 0
where item_category = 3
  and coalesce(smd_unit_price, 0) = 0
  and coalesce(dip_unit_price, 0) = 0
  and coalesce(material_unit_price, 0) = 0
  and coalesce(unit_price, 0) > 0;

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
  if new.pcb_side_mode not in ('', 'single', 'dual') then
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
