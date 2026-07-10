-- Supabase SQL Editor에서 실행하세요
-- bom_items + 주문 → order_assembly_groups 백필 (멱등 — 여러 번 실행 가능)
--
-- [선행] FK가 products 를 가리키면 setup-bom.sql 하단 FK 교체 구문을 먼저 실행하세요.
--
-- [우리 업무 흐름]
--   주문서: SFG-001, SFG-002 (반제품만 각각 라인)
--   BOM:    FG-0001 → SFG-001 + SFG-002
--   후공정: FG-0001 완제품 세트 수량으로 생산입력

-- ---------------------------------------------------------------------------
-- 1) 진단
-- ---------------------------------------------------------------------------

select
  ol.order_id,
  coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), '')) as item_id,
  ol.quantity
from public.order_lines ol
join public.items i
  on i.id = coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), ''))
where i.item_category = 3
  and ol.derived_from_line_id is null
order by ol.order_id, ol.line_seq;

select
  bom.parent_product_id as fg_id,
  parent.name as fg_name,
  bom.child_product_id as sfg_id,
  child.name as sfg_name,
  bom.quantity_per
from public.bom_items bom
join public.items parent on parent.id = bom.parent_product_id
join public.items child on child.id = bom.child_product_id
where parent.item_category = 4
  and child.item_category = 3
order by bom.parent_product_id, bom.child_product_id;

-- ---------------------------------------------------------------------------
-- 2-A) 반제품만 주문 → BOM으로 FG 조립 그룹
-- ---------------------------------------------------------------------------

with bom_children as (
  select
    bom.parent_product_id,
    bom.child_product_id,
    bom.quantity_per
  from public.bom_items bom
  join public.items parent on parent.id = bom.parent_product_id and parent.item_category = 4
),
parent_child_counts as (
  select parent_product_id, count(*)::integer as child_count
  from bom_children
  group by parent_product_id
),
order_matches as (
  select
    child_ol.order_id,
    bc.parent_product_id,
    child_ol.id as order_line_id,
    bc.child_product_id,
    bc.quantity_per,
    floor(coalesce(child_ol.quantity, 0) / greatest(bc.quantity_per, 1))::integer as child_sets
  from bom_children bc
  join public.order_lines child_ol
    on child_ol.order_id is not null
   and coalesce(nullif(trim(child_ol.product_id), ''), nullif(trim(child_ol.product_code), '')) = bc.child_product_id
   and child_ol.derived_from_line_id is null
),
eligible_children_only as (
  select
    om.order_id,
    om.parent_product_id,
    min(om.child_sets) as target_quantity
  from order_matches om
  join parent_child_counts pcc on pcc.parent_product_id = om.parent_product_id
  group by om.order_id, om.parent_product_id, pcc.child_count
  having count(distinct om.child_product_id) = max(pcc.child_count)
     and min(om.child_sets) > 0
     and not exists (
       select 1
       from public.order_lines fg_ol
       where fg_ol.order_id = om.order_id
         and fg_ol.derived_from_line_id is null
         and coalesce(nullif(trim(fg_ol.product_id), ''), nullif(trim(fg_ol.product_code), '')) = om.parent_product_id
     )
)
insert into public.order_assembly_groups (order_id, parent_product_id, target_quantity, group_seq)
select
  e.order_id,
  e.parent_product_id,
  e.target_quantity,
  (row_number() over (partition by e.order_id order by e.parent_product_id) - 1)::integer as group_seq
from eligible_children_only e
where not exists (
  select 1
  from public.order_assembly_groups g
  where g.order_id = e.order_id
    and g.parent_product_id = e.parent_product_id
);

-- ---------------------------------------------------------------------------
-- 2-B) 주문에 FG가 직접 있는 경우
-- ---------------------------------------------------------------------------

insert into public.order_assembly_groups (order_id, parent_product_id, target_quantity, group_seq)
select
  ol.order_id,
  coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), '')) as parent_product_id,
  greatest(1, floor(coalesce(ol.quantity, 0))::integer) as target_quantity,
  (row_number() over (partition by ol.order_id order by ol.line_seq) - 1)::integer as group_seq
from public.order_lines ol
join public.items parent
  on parent.id = coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), ''))
where parent.item_category = 4
  and ol.derived_from_line_id is null
  and not exists (
    select 1
    from public.order_assembly_groups g
    where g.order_id = ol.order_id
      and g.parent_product_id = coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), ''))
  );

-- ---------------------------------------------------------------------------
-- 2-C) 단일 보드 (FG 없음) — SFG 주문 라인을 그대로 조립 그룹으로
--        (이미 FG 조립 그룹의 BOM 자식인 SFG는 제외)
-- ---------------------------------------------------------------------------

insert into public.order_assembly_groups (order_id, parent_product_id, target_quantity, group_seq)
select
  ol.order_id,
  coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), '')) as parent_product_id,
  greatest(1, floor(coalesce(ol.quantity, 0))::integer) as target_quantity,
  (900 + row_number() over (partition by ol.order_id order by ol.line_seq))::integer as group_seq
from public.order_lines ol
join public.items sfg
  on sfg.id = coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), ''))
 and sfg.item_category = 3
where ol.derived_from_line_id is null
  and not exists (
    select 1
    from public.order_assembly_groups g
    where g.order_id = ol.order_id
      and g.parent_product_id = coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), ''))
  )
  and not exists (
    select 1
    from public.order_assembly_group_lines linked
    where linked.order_line_id = ol.id
  )
  and not exists (
    select 1
    from public.order_assembly_groups fg_g
    join public.bom_items bom on bom.parent_product_id = fg_g.parent_product_id
    join public.items fg_item on fg_item.id = fg_g.parent_product_id and fg_item.item_category = 4
    where fg_g.order_id = ol.order_id
      and bom.child_product_id = coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), ''))
  );

-- ---------------------------------------------------------------------------
-- 3) 조립 그룹 라인 연결 (BOM 자식 ↔ 주문 SFG 라인)
--    order_line_id 는 전역 유일 — 이미 연결된 라인은 건너뜀
-- ---------------------------------------------------------------------------

insert into public.order_assembly_group_lines (
  assembly_group_id,
  order_line_id,
  child_product_id,
  quantity_per
)
select distinct on (g.id, bom.child_product_id)
  g.id,
  child_ol.id,
  bom.child_product_id,
  bom.quantity_per
from public.order_assembly_groups g
join public.bom_items bom on bom.parent_product_id = g.parent_product_id
join public.order_lines child_ol
  on child_ol.order_id = g.order_id
 and coalesce(nullif(trim(child_ol.product_id), ''), nullif(trim(child_ol.product_code), '')) = bom.child_product_id
 and child_ol.derived_from_line_id is null
where not exists (
  select 1
  from public.order_assembly_group_lines existing
  where existing.assembly_group_id = g.id
    and existing.child_product_id = bom.child_product_id
)
and not exists (
  select 1
  from public.order_assembly_group_lines existing
  where existing.order_line_id = child_ol.id
)
order by g.id, bom.child_product_id, child_ol.line_seq;

-- ---------------------------------------------------------------------------
-- 4) 단일 보드 조립 그룹 라인 (SFG 1:1 자기 자신)
-- ---------------------------------------------------------------------------

insert into public.order_assembly_group_lines (
  assembly_group_id,
  order_line_id,
  child_product_id,
  quantity_per
)
select
  g.id,
  ol.id,
  g.parent_product_id,
  1
from public.order_assembly_groups g
join public.order_lines ol
  on ol.order_id = g.order_id
 and coalesce(nullif(trim(ol.product_id), ''), nullif(trim(ol.product_code), '')) = g.parent_product_id
 and ol.derived_from_line_id is null
join public.items sfg on sfg.id = g.parent_product_id and sfg.item_category = 3
where not exists (
  select 1 from public.order_assembly_group_lines existing where existing.assembly_group_id = g.id
)
and not exists (
  select 1 from public.order_assembly_group_lines existing where existing.order_line_id = ol.id
);

-- ---------------------------------------------------------------------------
-- 5) 결과 확인
-- ---------------------------------------------------------------------------

select
  g.order_id,
  g.parent_product_id as product_id,
  parent.name as product_name,
  parent.item_category,
  g.target_quantity as sets,
  string_agg(line.child_product_id, ' + ' order by line.child_product_id) as components
from public.order_assembly_groups g
join public.items parent on parent.id = g.parent_product_id
left join public.order_assembly_group_lines line on line.assembly_group_id = g.id
group by g.id, g.order_id, g.parent_product_id, parent.name, parent.item_category, g.target_quantity
order by g.order_id, g.parent_product_id;
