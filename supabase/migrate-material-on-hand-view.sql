-- 자재 현재고: 입고/불출 라인을 DB에서 자재별 합산 (앱 전량 조회·1000행 절단 방지)
-- Supabase SQL Editor에서 실행하세요 (setup-material-inbound / outbound 이후)

create or replace view public.material_on_hand as
with inbound as (
  select material_id, sum(quantity)::numeric as qty
  from public.material_inbound_lines
  group by material_id
),
outbound as (
  select material_id, sum(quantity)::numeric as qty
  from public.material_outbound_lines
  group by material_id
)
select
  coalesce(i.material_id, o.material_id) as material_id,
  coalesce(i.qty, 0) - coalesce(o.qty, 0) as on_hand
from inbound i
full outer join outbound o on o.material_id = i.material_id;

comment on view public.material_on_hand is '자재별 현재고 (입고합 − 불출합). 라인 전량 전송 없이 집계만 조회';

grant select on public.material_on_hand to anon, authenticated;
