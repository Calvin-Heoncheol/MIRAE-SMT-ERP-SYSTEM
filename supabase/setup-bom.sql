-- Supabase SQL Editor에서 실행하세요
--   setup-orders.sql → setup-items.sql 이후
--
-- BOM (단일 테이블)
--   parent_product_id: 완제품(4) 또는 반제품(3) items.id
--   child_product_id:  반제품(3) 또는 원자재·부자재(1·2) items.id
--   quantity_per:      부모 1단위당 자식 소요량
--
-- 규칙
--   완제품(4) → 반제품(3)
--   반제품(3) → 원자재(1)·부자재(2)
--
-- [주문 ↔ 생산입력 흐름]
--   FG 주문  → SMT 생산입력: BOM으로 SFG 라인 펼침 (derived lines)
--   SFG 주문 → 후공정 생산입력: BOM으로 FG 조립 그룹 생성 (SFG-001+SFG-002 → FG)
--   단일보드 (FG 미등록): 후공정에 SFG 주문카드 그대로 표시
--
-- [BOM만 초기화]
--   drop table if exists public.order_assembly_group_lines cascade;
--   drop table if exists public.order_assembly_groups cascade;
--   drop table if exists public.bom_items cascade;

-- ---------------------------------------------------------------------------
-- BOM
-- ---------------------------------------------------------------------------

create table if not exists public.bom_items (
  parent_product_id text not null references public.items(id) on delete cascade,
  child_product_id text not null references public.items(id) on delete restrict,
  quantity_per numeric not null default 1 check (quantity_per > 0),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (parent_product_id, child_product_id),
  constraint bom_items_no_self_reference check (parent_product_id <> child_product_id)
);

comment on table public.bom_items is 'BOM — 완제품/반제품 → 하위 품목 구성';
comment on column public.bom_items.parent_product_id is '부모 품목 items.id (완제품 4 또는 반제품 3)';
comment on column public.bom_items.child_product_id is '자식 품목 items.id (반제품 3 또는 원자재·부자재 1·2)';
comment on column public.bom_items.quantity_per is '부모 1단위당 자식 소요량';

create index if not exists bom_items_parent_idx on public.bom_items (parent_product_id);
create index if not exists bom_items_child_idx on public.bom_items (child_product_id);

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

drop view if exists public.bom_detail;

create view public.bom_detail as
select
  bom.parent_product_id,
  parent.name as parent_product_name,
  parent.item_category as parent_item_category,
  bom.child_product_id,
  child.name as child_product_name,
  child.item_category as child_item_category,
  child.mpn as child_mpn,
  child.pcb_side_mode as child_pcb_side_mode,
  bom.quantity_per,
  bom.note
from public.bom_items bom
join public.items parent on parent.id = bom.parent_product_id
join public.items child on child.id = bom.child_product_id
order by bom.parent_product_id, child.name;

comment on view public.bom_detail is 'BOM 상세 (부모·자식 품목명·구분 포함)';

drop view if exists public.order_assembly_group_detail;

create view public.order_assembly_group_detail as
select
  grp.id as assembly_group_id,
  grp.order_id,
  ord.id as order_number,
  grp.parent_product_id,
  parent.name as parent_product_name,
  grp.target_quantity,
  grp.group_seq,
  line.id as group_line_id,
  line.order_line_id,
  ol.line_seq as order_line_seq,
  line.child_product_id,
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

alter table public.bom_items enable row level security;
alter table public.order_assembly_groups enable row level security;
alter table public.order_assembly_group_lines enable row level security;

drop policy if exists "bom_items public read" on public.bom_items;
create policy "bom_items public read" on public.bom_items for select using (true);

drop policy if exists "bom_items public insert" on public.bom_items;
create policy "bom_items public insert" on public.bom_items for insert with check (true);

drop policy if exists "bom_items public update" on public.bom_items;
create policy "bom_items public update" on public.bom_items for update using (true) with check (true);

drop policy if exists "bom_items public delete" on public.bom_items;
create policy "bom_items public delete" on public.bom_items for delete using (true);

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

grant select on public.bom_detail to anon, authenticated;
grant select on public.order_assembly_group_detail to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 트리거
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

create or replace function public.normalize_bom_item_row()
returns trigger
language plpgsql
as $$
declare
  parent_category smallint;
  child_category smallint;
begin
  new.note := coalesce(trim(new.note), '');
  new.quantity_per := coalesce(new.quantity_per, 1);
  if new.quantity_per <= 0 then
    new.quantity_per := 1;
  end if;

  select item_category into parent_category
  from public.items
  where id = new.parent_product_id;

  if parent_category is null then
    raise exception '부모 품목(parent_product_id)이 존재하지 않습니다.';
  end if;

  if parent_category not in (3, 4) then
    raise exception '부모 품목은 반제품(3) 또는 완제품(4)만 등록할 수 있습니다.';
  end if;

  select item_category into child_category
  from public.items
  where id = new.child_product_id;

  if child_category is null then
    raise exception '자식 품목(child_product_id)이 존재하지 않습니다.';
  end if;

  if parent_category = 4 and child_category <> 3 then
    raise exception '완제품 BOM의 자식은 반제품(3)이어야 합니다.';
  end if;

  if parent_category = 3 and child_category not in (1, 2) then
    raise exception '반제품 BOM의 자식은 원자재(1) 또는 부자재(2)이어야 합니다.';
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

drop trigger if exists bom_items_normalize_row on public.bom_items;
create trigger bom_items_normalize_row
  before insert or update on public.bom_items
  for each row
  execute function public.normalize_bom_item_row();

drop trigger if exists bom_items_updated_at on public.bom_items;
create trigger bom_items_updated_at
  before update on public.bom_items
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
-- 기존 DB: product FK 가 products 를 가리키면 items 로 교체
-- ---------------------------------------------------------------------------

alter table public.order_assembly_groups drop constraint if exists order_assembly_groups_parent_product_id_fkey;
alter table public.order_assembly_groups
  add constraint order_assembly_groups_parent_product_id_fkey
  foreign key (parent_product_id) references public.items(id) on delete restrict;

alter table public.order_assembly_group_lines drop constraint if exists order_assembly_group_lines_child_product_id_fkey;
alter table public.order_assembly_group_lines
  add constraint order_assembly_group_lines_child_product_id_fkey
  foreign key (child_product_id) references public.items(id) on delete restrict;

alter table public.bom_items drop constraint if exists bom_items_parent_product_id_fkey;
alter table public.bom_items
  add constraint bom_items_parent_product_id_fkey
  foreign key (parent_product_id) references public.items(id) on delete cascade;

alter table public.bom_items drop constraint if exists bom_items_child_product_id_fkey;
alter table public.bom_items
  add constraint bom_items_child_product_id_fkey
  foreign key (child_product_id) references public.items(id) on delete restrict;

-- ---------------------------------------------------------------------------
-- [등록 예시] items 등록 후 품목코드로 치환하여 실행
-- ---------------------------------------------------------------------------
--
-- 완제품 BOM (FG-0001 = SFG-0001 + SFG-0002):
--   insert into bom_items (parent_product_id, child_product_id, quantity_per)
--   values
--     ('FG-0001', 'SFG-0001', 1),
--     ('FG-0001', 'SFG-0002', 1);
--
-- 반제품 BOM (SFG-0001 → 원자재):
--   insert into bom_items (parent_product_id, child_product_id, quantity_per)
--   values ('SFG-0001', 'MRM-0001', 1);
