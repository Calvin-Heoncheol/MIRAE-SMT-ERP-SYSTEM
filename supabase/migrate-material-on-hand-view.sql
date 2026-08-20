-- 자재 현재고: 입고/불출 라인을 DB에서 자재별 합산 (앱 전량 조회·1000행 절단 방지)
-- Supabase SQL Editor에서 실행하세요 (setup-material-inbound / outbound 이후)

create or replace view public.material_on_hand as
select
  material_id,
  coalesce(sum(remaining_qty), 0)::numeric as on_hand
from public.material_inbound_lines
group by material_id;

comment on view public.material_on_hand is '자재별 현재고 = 릴 remaining_qty 합 (창고 실물)';

grant select on public.material_on_hand to anon, authenticated;
