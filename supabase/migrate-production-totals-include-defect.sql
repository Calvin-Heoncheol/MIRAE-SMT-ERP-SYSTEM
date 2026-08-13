-- 생산 누적 뷰에 불량 합계 컬럼 추가 (게이지 표시용)
-- 양품(total_quantity)은 기존과 동일하게 defect 미포함

drop view if exists public.smt_production_totals;

create view public.smt_production_totals as
select
  order_line_id,
  pcb_side,
  coalesce(sum(quantity), 0)::integer as total_quantity,
  coalesce(sum(defect_quantity), 0)::integer as total_defect_quantity
from public.smt_production_records
group by order_line_id, pcb_side;

comment on view public.smt_production_totals is
  'SMT 주문 라인·면구분별 누적 양품(total_quantity)·불량(total_defect_quantity)';

grant select on public.smt_production_totals to anon, authenticated;

drop view if exists public.post_process_production_totals;

create view public.post_process_production_totals as
select
  assembly_group_id,
  coalesce(sum(quantity), 0)::integer as total_quantity,
  coalesce(sum(defect_quantity), 0)::integer as total_defect_quantity
from public.post_process_production_records
group by assembly_group_id;

comment on view public.post_process_production_totals is
  '후공정 조립 그룹별 누적 양품(total_quantity)·불량(total_defect_quantity)';

grant select on public.post_process_production_totals to anon, authenticated;
