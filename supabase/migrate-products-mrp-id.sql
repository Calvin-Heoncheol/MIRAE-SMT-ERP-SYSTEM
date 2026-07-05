-- Supabase SQL Editor에서 실행하세요
-- products.id 를 MRP0001 자동 발급 text 로 전환
--
-- 주의:
--   - products 에 UUID 형태 id 가 이미 있으면 CHECK 제약에서 실패합니다.
--     → reset-erp.sql 후 setup 전체 재실행 권장
--   - 데이터 거의 없을 때: products·BOM truncate 후 실행해도 됩니다.

-- 0) products.id 를 참조하는 뷰 제거
drop view if exists public.order_assembly_group_detail;
drop view if exists public.semi_product_bom_detail;
drop view if exists public.finished_product_bom_detail;

-- 1) BOM·주문 FK 제거 (products.id 타입 변경 준비)
alter table if exists public.order_assembly_group_lines drop constraint if exists order_assembly_group_lines_child_product_id_fkey;
alter table if exists public.order_assembly_groups drop constraint if exists order_assembly_groups_parent_product_id_fkey;
alter table if exists public.semi_product_bom_items drop constraint if exists semi_product_bom_items_product_id_fkey;
alter table if exists public.finished_product_bom_items drop constraint if exists finished_product_bom_items_parent_product_id_fkey;
alter table if exists public.finished_product_bom_items drop constraint if exists finished_product_bom_items_child_product_id_fkey;
alter table if exists public.order_lines drop constraint if exists order_lines_product_id_fkey;

-- 2) products.id → text
alter table public.products drop constraint if exists products_id_mrp_format_check;
alter table public.products alter column id drop default;
alter table public.products alter column id type text using id::text;

alter table public.products
  add constraint products_id_mrp_format_check check (id ~ '^MRP[0-9]+$');

-- 3) MRP 발급 함수·트리거
create or replace function public.generate_product_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRP', ''), '')::integer
  ), 0)
  into max_num
  from public.products
  where id ~ '^MRP[0-9]+$';

  next_num := max_num + 1;
  return 'MRP' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_product_code() to anon, authenticated;

create or replace function public.normalize_products_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_product_code();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.customer := coalesce(trim(new.customer), '');
  new.product_name := coalesce(trim(new.product_name), '');
  new.default_unit_price := coalesce(new.default_unit_price, 0);
  new.pcb_side_mode := lower(coalesce(trim(new.pcb_side_mode), 'single'));
  if new.pcb_side_mode not in ('single', 'dual') then
    new.pcb_side_mode := 'single';
  end if;
  new.product_kind := lower(coalesce(trim(new.product_kind), 'pcb'));
  if new.product_kind not in ('pcb', 'assembly') then
    new.product_kind := 'pcb';
  end if;
  return new;
end;
$$;

drop trigger if exists products_normalize_row on public.products;
create trigger products_normalize_row
  before insert or update on public.products
  for each row
  execute function public.normalize_products_row();

comment on column public.products.id is '내부 제품코드 MRP0001 (INSERT 시 자동 발급, 수정 불가)';

-- 4) FK 컬럼 text 로 맞추고 재연결
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'order_lines' and column_name = 'product_id') then
    alter table public.order_lines alter column product_id type text using product_id::text;
    alter table public.order_lines drop constraint if exists order_lines_product_id_fkey;
    alter table public.order_lines
      add constraint order_lines_product_id_fkey foreign key (product_id) references public.products(id) on delete set null;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'finished_product_bom_items') then
    alter table public.finished_product_bom_items alter column parent_product_id type text using parent_product_id::text;
    alter table public.finished_product_bom_items alter column child_product_id type text using child_product_id::text;
    alter table public.finished_product_bom_items drop constraint if exists finished_product_bom_items_parent_product_id_fkey;
    alter table public.finished_product_bom_items drop constraint if exists finished_product_bom_items_child_product_id_fkey;
    alter table public.finished_product_bom_items
      add constraint finished_product_bom_items_parent_product_id_fkey foreign key (parent_product_id) references public.products(id) on delete cascade;
    alter table public.finished_product_bom_items
      add constraint finished_product_bom_items_child_product_id_fkey foreign key (child_product_id) references public.products(id) on delete restrict;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'semi_product_bom_items') then
    alter table public.semi_product_bom_items alter column product_id type text using product_id::text;
    alter table public.semi_product_bom_items drop constraint if exists semi_product_bom_items_product_id_fkey;
    alter table public.semi_product_bom_items
      add constraint semi_product_bom_items_product_id_fkey foreign key (product_id) references public.products(id) on delete cascade;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'order_assembly_groups') then
    alter table public.order_assembly_groups alter column parent_product_id type text using parent_product_id::text;
    alter table public.order_assembly_groups drop constraint if exists order_assembly_groups_parent_product_id_fkey;
    alter table public.order_assembly_groups
      add constraint order_assembly_groups_parent_product_id_fkey foreign key (parent_product_id) references public.products(id) on delete restrict;
  end if;

  if exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'order_assembly_group_lines') then
    alter table public.order_assembly_group_lines alter column child_product_id type text using child_product_id::text;
    alter table public.order_assembly_group_lines drop constraint if exists order_assembly_group_lines_child_product_id_fkey;
    alter table public.order_assembly_group_lines
      add constraint order_assembly_group_lines_child_product_id_fkey foreign key (child_product_id) references public.products(id) on delete restrict;
  end if;
end $$;

-- 5) 뷰 재생성
create view public.finished_product_bom_detail as
select
  bom.id,
  bom.parent_product_id,
  parent.id as parent_product_code,
  parent.product_name as parent_product_name,
  parent.product_kind as parent_product_kind,
  bom.child_product_id,
  child.id as child_product_code,
  child.product_name as child_product_name,
  child.product_kind as child_product_kind,
  child.pcb_side_mode as child_pcb_side_mode,
  bom.quantity_per,
  bom.note
from public.finished_product_bom_items bom
join public.products parent on parent.id = bom.parent_product_id
join public.products child on child.id = bom.child_product_id
order by bom.parent_product_id, child.product_name;

create view public.semi_product_bom_detail as
select
  bom.id,
  bom.product_id,
  product.id as product_code,
  product.product_name,
  product.product_kind,
  bom.material_id,
  mat.id as material_code,
  mat.material_name,
  mat.cpn,
  mat.mpn,
  mat.process,
  bom.quantity_per,
  bom.ref_designator,
  bom.note
from public.semi_product_bom_items bom
join public.products product on product.id = bom.product_id
join public.materials mat on mat.id = bom.material_id
order by bom.product_id, mat.material_name, bom.ref_designator;

create view public.order_assembly_group_detail as
select
  grp.id as assembly_group_id,
  grp.order_id,
  ord.id as order_number,
  grp.parent_product_id,
  parent.id as parent_product_code,
  parent.product_name as parent_product_name,
  grp.target_quantity,
  grp.group_seq,
  line.id as group_line_id,
  line.order_line_id,
  ol.line_seq as order_line_seq,
  line.child_product_id,
  child.id as child_product_code,
  child.product_name as child_product_name,
  ol.quantity as order_line_quantity,
  line.quantity_per
from public.order_assembly_groups grp
join public.orders ord on ord.id = grp.order_id
join public.products parent on parent.id = grp.parent_product_id
left join public.order_assembly_group_lines line on line.assembly_group_id = grp.id
left join public.order_lines ol on ol.id = line.order_line_id
left join public.products child on child.id = line.child_product_id
order by grp.order_id, grp.group_seq, ol.line_seq;

grant select on public.finished_product_bom_detail to anon, authenticated;
grant select on public.semi_product_bom_detail to anon, authenticated;
grant select on public.order_assembly_group_detail to anon, authenticated;
