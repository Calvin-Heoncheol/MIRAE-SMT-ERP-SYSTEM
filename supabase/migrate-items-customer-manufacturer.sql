-- 품목 마스터: 고객사(FK) 추가, 공정은 직접 입력 유지
-- 패키지/MPN/사양은 전 품목구분에서 사용
-- 제조사 컬럼은 제거됨 — migrate-items-drop-manufacturer.sql 참고
-- Supabase SQL Editor에서 실행하세요.

alter table public.items
  add column if not exists customer_reg_no text;

comment on column public.items.customer_reg_no is '고객사 FK (business_partners.business_reg_no)';
comment on column public.items.package is '패키지';
comment on column public.items.specification is '상세 사양';
comment on column public.items.process_type is '공정 구분: smt=SMT, post=후공정, smt_post=SMT+후공정';

do $$
begin
  if to_regclass('public.business_partners') is null then
    return;
  end if;
  alter table public.items add column if not exists customer_id text;
  alter table public.items drop constraint if exists items_customer_reg_no_fkey;
  alter table public.items drop constraint if exists items_customer_id_fkey;
  alter table public.items
    add constraint items_customer_id_fkey
    foreign key (customer_id) references public.business_partners(id)
    on delete set null;
end;
$$;

create index if not exists items_customer_reg_no_idx on public.items (customer_reg_no);

drop index if exists public.items_raw_material_base_code_uidx;

drop index if exists public.items_customer_code_version_uidx;
create unique index if not exists items_customer_code_version_uidx
  on public.items (
    coalesce(customer_id, ''),
    lower(btrim(base_code)),
    lower(btrim(version))
  );

create or replace function public.normalize_items_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(trim(new.id), '');
    if new.id = '' or new.id !~ '^MR-[0-9]{5,}$' then
      new.id := public.generate_item_id();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.name := coalesce(trim(new.name), '');
  if new.name = '' then
    raise exception '품목명은 필수입니다.';
  end if;

  new.specification := coalesce(trim(new.specification), '');
  new.package := coalesce(trim(new.package), '');
  new.mpn := coalesce(trim(new.mpn), '');
  new.customer_id := nullif(btrim(coalesce(new.customer_id, '')), '');
  new.customer_reg_no := nullif(btrim(coalesce(new.customer_reg_no, '')), '');

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
  elsif new.pcb_side_mode = '' then
    new.pcb_side_mode := 'single';
  end if;

  new.process_type := lower(coalesce(trim(new.process_type), ''));
  if new.process_type not in ('', 'smt', 'post', 'smt_post') then
    new.process_type := '';
  end if;

  if new.item_category = 3 then
    new.unit_price :=
      new.smd_unit_price
      + new.dip_unit_price
      + new.material_unit_price
      + new.other_unit_price;
  end if;

  return new;
end;
$$;
