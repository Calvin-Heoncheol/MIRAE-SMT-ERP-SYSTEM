-- 자재 생산계획 분할 배정: 동일 발주라인에 입고일별 여러 계획 허용
-- Supabase SQL Editor에서 실행하세요

drop index if exists production_plan_board_material_line_uidx;

create unique index if not exists production_plan_board_material_line_date_uidx
  on public.production_plan_board_items (order_line_id, planned_date)
  where scope = 'material' and order_line_id is not null and planned_date is not null;

comment on index public.production_plan_board_material_line_date_uidx is
  '자재 scope — 발주라인·입고일 조합당 하나의 계획';
