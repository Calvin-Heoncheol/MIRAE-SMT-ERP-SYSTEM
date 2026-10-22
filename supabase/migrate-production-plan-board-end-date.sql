-- 생산계획 보드(자재 일정)에 종료일 추가 — 자재·SMD·후공정 기간 배정용
alter table public.production_plan_board_items
  add column if not exists planned_end_date date;

update public.production_plan_board_items
set planned_end_date = planned_date
where planned_end_date is null
  and planned_date is not null;

comment on column public.production_plan_board_items.planned_end_date is '계획 종료일 (없으면 시작일과 동일)';
