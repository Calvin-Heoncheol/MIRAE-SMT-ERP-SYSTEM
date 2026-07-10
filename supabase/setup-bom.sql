-- Supabase SQL Editor에서 실행하세요
--   setup-orders.sql → setup-items.sql 이후
--
-- 완제품 BOM: items(완제품) → items(반제품)
-- 반제품 BOM: items(반제품) → items(원자재·부자재)
-- 주문 조립 그룹: 완제품 BOM 기준으로 주문 라인을 세트 단위로 묶음
--
-- [BOM만 초기화]
--   drop table if exists public.order_assembly_group_lines cascade;
--   drop table if exists public.order_assembly_groups cascade;
--   drop table if exists public.semi_product_bom_items cascade;
--   drop table if exists public.finished_product_bom_items cascade;

-- ---------------------------------------------------------------------------
-- 완제품 BOM (finished product BOM)
-- ---------------------------------------------------------------------------

create table if not exists public.finished_product_bom_items (
  parent_product_id text not null references public.items(id) on delete cascade,
  child_product_id text not null references public.items(id) on delete restrict,
  quantity_per numeric not null default 1 check (quantity_per > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (parent_product_id, child_product_id),
  constraint finished_product_bom_items_no_self_reference check (parent_product_id <> child_product_id)
);

comment on table public.finished_product_bom_items is '완제품 BOM — 완제품(assembly) → 반제품(pcb) 구성';
comment on column public.finished_product_bom_items.parent_product_id is '완제품 items.id (item_category=finished_product)';
comment on column public.finished_product_bom_items.child_product_id is '반제품 items.id (item_category=semi_finished)';
comment on column public.finished_product_bom_items.quantity_per is '완제품 1세트당 반제품 수량';

create index if not exists finished_product_bom_items_parent_idx
  on public.finished_product_bom_items (parent_product_id);

create index if not exists finished_product_bom_items_child_idx
  on public.finished_product_bom_items (child_product_id);

-- ---------------------------------------------------------------------------
-- 반제품 BOM (semi-finished product BOM)
-- ---------------------------------------------------------------------------

create table if not exists public.semi_product_bom_items (
  product_id text not null references public.items(id) on delete cascade,
  material_id text not null references public.items(id) on delete restrict,
  ref_designator text not null default '',
  quantity_per numeric not null default 1 check (quantity_per > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (product_id, material_id, ref_designator)
);

comment on table public.semi_product_bom_items is '반제품 BOM — 반제품 → 원자재·부자재 소요';
comment on column public.semi_product_bom_items.product_id is '반제품 items.id (item_category=semi_finished)';
comment on column public.semi_product_bom_items.material_id is '원자재·부자재 items.id';
comment on column public.semi_product_bom_items.quantity_per is '반제품 1대당 자재 수량';
comment on column public.semi_product_bom_items.ref_designator is '부품 위치 (R1, C3 등, 없으면 빈 문자열)';

create index if not exists semi_product_bom_items_product_idx
  on public.semi_product_bom_items (product_id);

create index if not exists semi_product_bom_items_material_idx
  on public.semi_product_bom_items (material_id);

-- ref_designator 포함 복합 PK 로 (product, material, ref) 유일성 보장

-- ---------------------------------------------------------------------------
-- 주문 조립 그룹 (완제품 BOM → 주문 라인 세트)
-- ---------------------------------------------------------------------------

create table if not exists public.order_assembly_groups (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  parent_product_id text not null references public.items(id) on delete restrict,
  target_quantity integer not null check (target_quantity > 0),
  group_seq integer not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint order_assembly_groups_order_group_seq_unique unique (order_id, group_seq)
);

comment on table public.order_assembly_groups is '주문별 완제품 조립 세트 — 후공정·출하 추적 단위';
comment on column public.order_assembly_groups.parent_product_id is '완제품 items.id';
comment on column public.order_assembly_groups.target_quantity is '완제품 목표 세트 수';

create index if not exists order_assembly_groups_order_id_idx
  on public.order_assembly_groups (order_id);

create index if not exists order_assembly_groups_parent_product_id_idx
  on public.order_assembly_groups (parent_product_id);

create table if not exists public.order_assembly_group_lines (
  id uuid primary key default gen_random_uuid(),
  assembly_group_id uuid not null references public.order_assembly_groups(id) on delete cascade,
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  child_product_id text not null references public.items(id) on delete restrict,
  quantity_per numeric not null default 1 check (quantity_per > 0),
  constraint order_assembly_group_lines_order_line_unique unique (order_line_id),
  constraint order_assembly_group_lines_group_child_unique unique (assembly_group_id, child_product_id)
);

comment on table public.order_assembly_group_lines is '조립 세트에 포함된 주문 라인(반제품)';
comment on column public.order_assembly_group_lines.order_line_id is '주문 라인 FK — 라인당 하나의 조립 그룹만';
comment on column public.order_assembly_group_lines.quantity_per is '완제품 1세트당 이 라인(반제품) 수량';

create index if not exists order_assembly_group_lines_assembly_group_id_idx
  on public.order_assembly_group_lines (assembly_group_id);

create index if not exists order_assembly_group_lines_child_product_id_idx
  on public.order_assembly_group_lines (child_product_id);

-- ---------------------------------------------------------------------------
-- 조회용 뷰
-- ---------------------------------------------------------------------------

drop view if exists public.finished_product_bom_detail;

create view public.finished_product_bom_detail as
select
  bom.parent_product_id,
  parent.id as parent_product_code,
  parent.name as parent_product_name,
  parent.item_category as parent_product_kind,
  bom.child_product_id,
  child.id as child_product_code,
  child.name as child_product_name,
  child.item_category as child_product_kind,
  'single'::text as child_pcb_side_mode,
  bom.quantity_per,
  bom.note
from public.finished_product_bom_items bom
join public.items parent on parent.id = bom.parent_product_id
join public.items child on child.id = bom.child_product_id
order by bom.parent_product_id, child.name;

comment on view public.finished_product_bom_detail is '완제품 BOM 상세 (제품명 포함)';

drop view if exists public.semi_product_bom_detail;

create view public.semi_product_bom_detail as
select
  bom.product_id,
  product.id as product_code,
  product.name as product_name,
  product.item_category as product_kind,
  bom.material_id,
  mat.id as material_code,
  mat.name as material_name,
  mat.mpn,
  mat.item_category as type,
  bom.quantity_per,
  bom.ref_designator,
  bom.note
from public.semi_product_bom_items bom
join public.items product on product.id = bom.product_id
join public.items mat on mat.id = bom.material_id
order by bom.product_id, mat.name, bom.ref_designator;

comment on view public.semi_product_bom_detail is '반제품 BOM 상세 (자재코드·자재명·MPN 포함)';

drop view if exists public.order_assembly_group_detail;

create view public.order_assembly_group_detail as
select
  grp.id as assembly_group_id,
  grp.order_id,
  ord.id as order_number,
  grp.parent_product_id,
  parent.id as parent_product_code,
  parent.name as parent_product_name,
  grp.target_quantity,
  grp.group_seq,
  line.id as group_line_id,
  line.order_line_id,
  ol.line_seq as order_line_seq,
  line.child_product_id,
  child.id as child_product_code,
  child.name as child_product_name,
  ol.quantity as order_line_quantity,
  line.quantity_per
from public.order_assembly_groups grp
join public.orders ord on ord.id = grp.order_id
join public.items parent on parent.id = grp.parent_product_id
left join public.order_assembly_group_lines line on line.assembly_group_id = grp.id
left join public.order_lines ol on ol.id = line.order_line_id
left join public.items child on child.id = line.child_product_id
order by grp.order_id, grp.group_seq, ol.line_seq;

comment on view public.order_assembly_group_detail is '주문 조립 세트 상세 (라인·반제품 포함)';

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.finished_product_bom_items enable row level security;
alter table public.semi_product_bom_items enable row level security;
alter table public.order_assembly_groups enable row level security;
alter table public.order_assembly_group_lines enable row level security;

drop policy if exists "finished_product_bom_items public read" on public.finished_product_bom_items;
create policy "finished_product_bom_items public read"
  on public.finished_product_bom_items for select using (true);

drop policy if exists "finished_product_bom_items public insert" on public.finished_product_bom_items;
create policy "finished_product_bom_items public insert"
  on public.finished_product_bom_items for insert with check (true);

drop policy if exists "finished_product_bom_items public update" on public.finished_product_bom_items;
create policy "finished_product_bom_items public update"
  on public.finished_product_bom_items for update using (true) with check (true);

drop policy if exists "finished_product_bom_items public delete" on public.finished_product_bom_items;
create policy "finished_product_bom_items public delete"
  on public.finished_product_bom_items for delete using (true);

drop policy if exists "semi_product_bom_items public read" on public.semi_product_bom_items;
create policy "semi_product_bom_items public read"
  on public.semi_product_bom_items for select using (true);

drop policy if exists "semi_product_bom_items public insert" on public.semi_product_bom_items;
create policy "semi_product_bom_items public insert"
  on public.semi_product_bom_items for insert with check (true);

drop policy if exists "semi_product_bom_items public update" on public.semi_product_bom_items;
create policy "semi_product_bom_items public update"
  on public.semi_product_bom_items for update using (true) with check (true);

drop policy if exists "semi_product_bom_items public delete" on public.semi_product_bom_items;
create policy "semi_product_bom_items public delete"
  on public.semi_product_bom_items for delete using (true);

drop policy if exists "order_assembly_groups public read" on public.order_assembly_groups;
create policy "order_assembly_groups public read"
  on public.order_assembly_groups for select using (true);

drop policy if exists "order_assembly_groups public insert" on public.order_assembly_groups;
create policy "order_assembly_groups public insert"
  on public.order_assembly_groups for insert with check (true);

drop policy if exists "order_assembly_groups public update" on public.order_assembly_groups;
create policy "order_assembly_groups public update"
  on public.order_assembly_groups for update using (true) with check (true);

drop policy if exists "order_assembly_groups public delete" on public.order_assembly_groups;
create policy "order_assembly_groups public delete"
  on public.order_assembly_groups for delete using (true);

drop policy if exists "order_assembly_group_lines public read" on public.order_assembly_group_lines;
create policy "order_assembly_group_lines public read"
  on public.order_assembly_group_lines for select using (true);

drop policy if exists "order_assembly_group_lines public insert" on public.order_assembly_group_lines;
create policy "order_assembly_group_lines public insert"
  on public.order_assembly_group_lines for insert with check (true);

drop policy if exists "order_assembly_group_lines public update" on public.order_assembly_group_lines;
create policy "order_assembly_group_lines public update"
  on public.order_assembly_group_lines for update using (true) with check (true);

drop policy if exists "order_assembly_group_lines public delete" on public.order_assembly_group_lines;
create policy "order_assembly_group_lines public delete"
  on public.order_assembly_group_lines for delete using (true);

grant select on public.finished_product_bom_detail to anon, authenticated;
grant select on public.semi_product_bom_detail to anon, authenticated;
grant select on public.order_assembly_group_detail to anon, authenticated;

-- ---------------------------------------------------------------------------
-- updated_at 트리거
-- ---------------------------------------------------------------------------

create or replace function public.touch_bom_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.normalize_finished_product_bom_row()
returns trigger
language plpgsql
as $$
begin
  new.note := coalesce(trim(new.note), '');
  new.quantity_per := coalesce(new.quantity_per, 1);
  if new.quantity_per <= 0 then
    new.quantity_per := 1;
  end if;
  return new;
end;
$$;

create or replace function public.normalize_semi_product_bom_row()
returns trigger
language plpgsql
as $$
begin
  new.note := coalesce(trim(new.note), '');
  new.ref_designator := coalesce(trim(new.ref_designator), '');
  new.quantity_per := coalesce(new.quantity_per, 1);
  if new.quantity_per <= 0 then
    new.quantity_per := 1;
  end if;
  return new;
end;
$$;

create or replace function public.normalize_order_assembly_group_row()
returns trigger
language plpgsql
as $$
begin
  new.note := coalesce(trim(new.note), '');
  return new;
end;
$$;

drop trigger if exists finished_product_bom_items_normalize_row on public.finished_product_bom_items;
create trigger finished_product_bom_items_normalize_row
  before insert or update on public.finished_product_bom_items
  for each row
  execute function public.normalize_finished_product_bom_row();

drop trigger if exists finished_product_bom_items_updated_at on public.finished_product_bom_items;
create trigger finished_product_bom_items_updated_at
  before update on public.finished_product_bom_items
  for each row
  execute function public.touch_bom_updated_at();

drop trigger if exists semi_product_bom_items_normalize_row on public.semi_product_bom_items;
create trigger semi_product_bom_items_normalize_row
  before insert or update on public.semi_product_bom_items
  for each row
  execute function public.normalize_semi_product_bom_row();

drop trigger if exists semi_product_bom_items_updated_at on public.semi_product_bom_items;
create trigger semi_product_bom_items_updated_at
  before update on public.semi_product_bom_items
  for each row
  execute function public.touch_bom_updated_at();

drop trigger if exists order_assembly_groups_normalize_row on public.order_assembly_groups;
create trigger order_assembly_groups_normalize_row
  before insert or update on public.order_assembly_groups
  for each row
  execute function public.normalize_order_assembly_group_row();

drop trigger if exists order_assembly_groups_updated_at on public.order_assembly_groups;
create trigger order_assembly_groups_updated_at
  before update on public.order_assembly_groups
  for each row
  execute function public.touch_bom_updated_at();

-- ---------------------------------------------------------------------------
-- [등록 예시] Amigo — products·materials 등록 후 UUID로 치환하여 실행
-- ---------------------------------------------------------------------------
--
-- 완제품·반제품 구분:
--   update products set product_kind = 'pcb' where product_name in ('Amigo main', 'Amigo sun');
--   update products set product_kind = 'assembly' where product_name = 'Amigo p60A';
--
-- 완제품 BOM (p60A = main + sun) — parent/child에 products.id(MRP-0001) 사용:
--   insert into finished_product_bom_items (parent_product_id, child_product_id, quantity_per)
--   values
--     ('MRP-0003', 'MRP-0001', 1),
--     ('MRP-0003', 'MRP-0002', 1);
--
-- 반제품 BOM:
--   insert into semi_product_bom_items (product_id, material_id, quantity_per, ref_designator)
--   values ('MRP-0001', 'MRM-0001', 1, 'U1');
