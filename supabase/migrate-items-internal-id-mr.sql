-- 품목 내부 PK: 표시 코드와 분리, MR-00001 자동채번
-- 기존 행 중 MR-##### 형식이 아닌 id 를 새 번호로 재부여하고 FK 를 따라 옮김
-- Supabase SQL Editor에서 실행하세요.
-- 이전 실행이 실패했어도 트랜잭션이 롤백되므로 이 파일을 다시 실행하면 됩니다.

create sequence if not exists public.item_id_seq;

create or replace function public.generate_item_id()
returns text
language plpgsql
as $$
declare
  next_num bigint;
  candidate text;
begin
  loop
    next_num := nextval('public.item_id_seq');
    candidate := 'MR-' || lpad(next_num::text, 5, '0');
    exit when not exists (
      select 1 from public.items where id = candidate
    );
  end loop;
  return candidate;
end;
$$;

grant execute on function public.generate_item_id() to anon, authenticated;

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

  if new.item_category is distinct from 1 then
    new.package := '';
  end if;

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

comment on table public.items is '품목 마스터 — 내부 PK=id(MR-00001), 표시 코드=base_code, 버전=version';
comment on column public.items.id is '내부 품목 PK. 저장 시 MR-00001 형식으로 자동 발급, 이후 변경 불가';
comment on column public.items.base_code is '표시용 품목코드 (고객사 코드 등, 버전 제외)';

-- ---------------------------------------------------------------------------
-- 기존 데이터 재부여 (이미 MR-00001 형식이면 유지)
-- ---------------------------------------------------------------------------
do $$
declare
  used_max bigint := 0;
  next_num bigint;
begin
  if not exists (
    select 1 from public.items where id !~ '^MR-[0-9]{5,}$'
  ) then
    select coalesce(max(substring(id from 4)::bigint), 0)
      into used_max
    from public.items
    where id ~ '^MR-[0-9]{5,}$';

    if used_max < 1 then
      perform setval('public.item_id_seq', 1, false);
    else
      perform setval('public.item_id_seq', used_max, true);
    end if;
    return;
  end if;

  create temporary table item_id_rekey (
    old_id text primary key,
    tmp_id text not null unique,
    new_id text not null unique
  ) on commit drop;

  select coalesce(max(substring(id from 4)::bigint), 0)
    into used_max
  from public.items
  where id ~ '^MR-[0-9]{5,}$';

  next_num := used_max;

  insert into item_id_rekey (old_id, tmp_id, new_id)
  select
    i.id,
    '__rekey_' || row_number() over (order by i.created_at, i.id),
    'MR-' || lpad((
      used_max + row_number() over (order by i.created_at, i.id)
    )::text, 5, '0')
  from public.items i
  where i.id !~ '^MR-[0-9]{5,}$';

  select used_max + count(*) into next_num from item_id_rekey;

  -- PK/FK 재부여 중 존재 검사 트리거(BOM 등)가 중간 상태를 거부하지 않도록 중지
  alter table public.items disable trigger user;
  if to_regclass('public.bom_items') is not null then
    alter table public.bom_items disable trigger user;
  end if;
  if to_regclass('public.order_assembly_groups') is not null then
    alter table public.order_assembly_groups disable trigger user;
  end if;
  if to_regclass('public.order_assembly_group_lines') is not null then
    alter table public.order_assembly_group_lines disable trigger user;
  end if;
  if to_regclass('public.order_lines') is not null then
    alter table public.order_lines disable trigger user;
  end if;
  if to_regclass('public.material_inbound_lines') is not null then
    alter table public.material_inbound_lines disable trigger user;
  end if;
  if to_regclass('public.material_outbound_lines') is not null then
    alter table public.material_outbound_lines disable trigger user;
  end if;
  if to_regclass('public.material_purchase_order_lines') is not null then
    alter table public.material_purchase_order_lines disable trigger user;
  end if;
  if to_regclass('public.metal_mask_assets') is not null then
    alter table public.metal_mask_assets disable trigger user;
  end if;

  if to_regclass('public.order_lines') is not null then
    alter table public.order_lines drop constraint if exists order_lines_product_id_fkey;
  end if;
  if to_regclass('public.bom_items') is not null then
    alter table public.bom_items drop constraint if exists bom_items_parent_product_id_fkey;
    alter table public.bom_items drop constraint if exists bom_items_child_product_id_fkey;
  end if;
  if to_regclass('public.order_assembly_groups') is not null then
    alter table public.order_assembly_groups drop constraint if exists order_assembly_groups_parent_product_id_fkey;
  end if;
  if to_regclass('public.order_assembly_group_lines') is not null then
    alter table public.order_assembly_group_lines drop constraint if exists order_assembly_group_lines_child_product_id_fkey;
  end if;
  if to_regclass('public.material_inbound_lines') is not null then
    alter table public.material_inbound_lines drop constraint if exists material_inbound_lines_material_id_fkey;
  end if;
  if to_regclass('public.material_outbound_lines') is not null then
    alter table public.material_outbound_lines drop constraint if exists material_outbound_lines_material_id_fkey;
  end if;
  if to_regclass('public.material_purchase_order_lines') is not null then
    alter table public.material_purchase_order_lines drop constraint if exists material_purchase_order_lines_material_id_fkey;
  end if;
  if to_regclass('public.metal_mask_assets') is not null then
    alter table public.metal_mask_assets drop constraint if exists metal_mask_assets_item_id_fkey;
  end if;

  update public.items as i
  set id = m.tmp_id
  from item_id_rekey m
  where i.id = m.old_id;

  if to_regclass('public.bom_items') is not null then
    update public.bom_items b
    set
      parent_product_id = coalesce(
        (select tmp_id from item_id_rekey where old_id = b.parent_product_id),
        b.parent_product_id
      ),
      child_product_id = coalesce(
        (select tmp_id from item_id_rekey where old_id = b.child_product_id),
        b.child_product_id
      )
    where exists (
      select 1 from item_id_rekey m
      where m.old_id in (b.parent_product_id, b.child_product_id)
    );
  end if;
  if to_regclass('public.order_assembly_groups') is not null then
    update public.order_assembly_groups g set parent_product_id = m.tmp_id from item_id_rekey m where g.parent_product_id = m.old_id;
  end if;
  if to_regclass('public.order_assembly_group_lines') is not null then
    update public.order_assembly_group_lines l set child_product_id = m.tmp_id from item_id_rekey m where l.child_product_id = m.old_id;
  end if;
  if to_regclass('public.order_lines') is not null then
    update public.order_lines ol set product_id = m.tmp_id from item_id_rekey m where ol.product_id = m.old_id;
  end if;
  if to_regclass('public.metal_mask_assets') is not null then
    update public.metal_mask_assets a set item_id = m.tmp_id from item_id_rekey m where a.item_id = m.old_id;
  end if;
  if to_regclass('public.material_inbound_lines') is not null then
    update public.material_inbound_lines l set material_id = m.tmp_id from item_id_rekey m where l.material_id = m.old_id;
  end if;
  if to_regclass('public.material_outbound_lines') is not null then
    update public.material_outbound_lines l set material_id = m.tmp_id from item_id_rekey m where l.material_id = m.old_id;
  end if;
  if to_regclass('public.material_purchase_order_lines') is not null then
    update public.material_purchase_order_lines l set material_id = m.tmp_id from item_id_rekey m where l.material_id = m.old_id;
  end if;
  if to_regclass('public.entity_change_logs') is not null then
    update public.entity_change_logs l
    set entity_id = m.tmp_id
    from item_id_rekey m
    where l.entity_type = 'item' and l.entity_id = m.old_id;
  end if;

  update public.items as i
  set id = m.new_id
  from item_id_rekey m
  where i.id = m.tmp_id;

  if to_regclass('public.bom_items') is not null then
    update public.bom_items b
    set
      parent_product_id = coalesce(
        (select new_id from item_id_rekey where tmp_id = b.parent_product_id),
        b.parent_product_id
      ),
      child_product_id = coalesce(
        (select new_id from item_id_rekey where tmp_id = b.child_product_id),
        b.child_product_id
      )
    where exists (
      select 1 from item_id_rekey m
      where m.tmp_id in (b.parent_product_id, b.child_product_id)
    );
  end if;
  if to_regclass('public.order_assembly_groups') is not null then
    update public.order_assembly_groups g set parent_product_id = m.new_id from item_id_rekey m where g.parent_product_id = m.tmp_id;
  end if;
  if to_regclass('public.order_assembly_group_lines') is not null then
    update public.order_assembly_group_lines l set child_product_id = m.new_id from item_id_rekey m where l.child_product_id = m.tmp_id;
  end if;
  if to_regclass('public.order_lines') is not null then
    update public.order_lines ol set product_id = m.new_id from item_id_rekey m where ol.product_id = m.tmp_id;
  end if;
  if to_regclass('public.metal_mask_assets') is not null then
    update public.metal_mask_assets a set item_id = m.new_id from item_id_rekey m where a.item_id = m.tmp_id;
  end if;
  if to_regclass('public.material_inbound_lines') is not null then
    update public.material_inbound_lines l set material_id = m.new_id from item_id_rekey m where l.material_id = m.tmp_id;
  end if;
  if to_regclass('public.material_outbound_lines') is not null then
    update public.material_outbound_lines l set material_id = m.new_id from item_id_rekey m where l.material_id = m.tmp_id;
  end if;
  if to_regclass('public.material_purchase_order_lines') is not null then
    update public.material_purchase_order_lines l set material_id = m.new_id from item_id_rekey m where l.material_id = m.tmp_id;
  end if;
  if to_regclass('public.entity_change_logs') is not null then
    update public.entity_change_logs l
    set entity_id = m.new_id
    from item_id_rekey m
    where l.entity_type = 'item' and l.entity_id = m.tmp_id;
  end if;

  if to_regclass('public.order_lines') is not null then
    alter table public.order_lines
      add constraint order_lines_product_id_fkey
      foreign key (product_id) references public.items(id) on delete set null;
  end if;
  if to_regclass('public.bom_items') is not null then
    alter table public.bom_items
      add constraint bom_items_parent_product_id_fkey
      foreign key (parent_product_id) references public.items(id) on delete cascade;
    alter table public.bom_items
      add constraint bom_items_child_product_id_fkey
      foreign key (child_product_id) references public.items(id) on delete restrict;
  end if;
  if to_regclass('public.order_assembly_groups') is not null then
    alter table public.order_assembly_groups
      add constraint order_assembly_groups_parent_product_id_fkey
      foreign key (parent_product_id) references public.items(id) on delete restrict;
  end if;
  if to_regclass('public.order_assembly_group_lines') is not null then
    alter table public.order_assembly_group_lines
      add constraint order_assembly_group_lines_child_product_id_fkey
      foreign key (child_product_id) references public.items(id) on delete restrict;
  end if;
  if to_regclass('public.material_inbound_lines') is not null then
    alter table public.material_inbound_lines
      add constraint material_inbound_lines_material_id_fkey
      foreign key (material_id) references public.items(id) on delete restrict;
  end if;
  if to_regclass('public.material_outbound_lines') is not null then
    alter table public.material_outbound_lines
      add constraint material_outbound_lines_material_id_fkey
      foreign key (material_id) references public.items(id) on delete restrict;
  end if;
  if to_regclass('public.material_purchase_order_lines') is not null then
    alter table public.material_purchase_order_lines
      add constraint material_purchase_order_lines_material_id_fkey
      foreign key (material_id) references public.items(id) on delete set null;
  end if;
  if to_regclass('public.metal_mask_assets') is not null then
    alter table public.metal_mask_assets
      add constraint metal_mask_assets_item_id_fkey
      foreign key (item_id) references public.items(id) on delete set null;
  end if;

  alter table public.items enable trigger user;
  if to_regclass('public.bom_items') is not null then
    alter table public.bom_items enable trigger user;
  end if;
  if to_regclass('public.order_assembly_groups') is not null then
    alter table public.order_assembly_groups enable trigger user;
  end if;
  if to_regclass('public.order_assembly_group_lines') is not null then
    alter table public.order_assembly_group_lines enable trigger user;
  end if;
  if to_regclass('public.order_lines') is not null then
    alter table public.order_lines enable trigger user;
  end if;
  if to_regclass('public.material_inbound_lines') is not null then
    alter table public.material_inbound_lines enable trigger user;
  end if;
  if to_regclass('public.material_outbound_lines') is not null then
    alter table public.material_outbound_lines enable trigger user;
  end if;
  if to_regclass('public.material_purchase_order_lines') is not null then
    alter table public.material_purchase_order_lines enable trigger user;
  end if;
  if to_regclass('public.metal_mask_assets') is not null then
    alter table public.metal_mask_assets enable trigger user;
  end if;

  if next_num < 1 then
    perform setval('public.item_id_seq', 1, false);
  else
    perform setval('public.item_id_seq', next_num, true);
  end if;
end;
$$;

-- 주문 라인 표시 코드는 base_code 유지 (내부 PK 로 덮지 않음)
do $$
begin
  if to_regclass('public.order_lines') is null then
    return;
  end if;
  update public.order_lines as ol
  set product_code = coalesce(nullif(btrim(i.base_code), ''), i.id)
  from public.items as i
  where ol.product_id = i.id
    and ol.product_code is distinct from coalesce(nullif(btrim(i.base_code), ''), i.id);
end;
$$;
