-- 생산계획 보드: 확정 시 날짜·라인(팀)·수량 배정
-- 이미 migrate-production-plan-board.sql 을 실행한 DB에서 이어서 실행하세요.

alter table public.production_plan_board_items
  add column if not exists planned_date date;

alter table public.production_plan_board_items
  add column if not exists line_no smallint;

alter table public.production_plan_board_items
  add column if not exists team text;

alter table public.production_plan_board_items
  add column if not exists pcb_side text not null default 'SINGLE';

alter table public.production_plan_board_items
  add column if not exists planned_quantity integer;

alter table public.production_plan_board_items
  drop constraint if exists production_plan_board_items_line_no_check;

alter table public.production_plan_board_items
  add constraint production_plan_board_items_line_no_check
  check (line_no is null or (line_no >= 1 and line_no <= 7));

alter table public.production_plan_board_items
  drop constraint if exists production_plan_board_items_pcb_side_check;

alter table public.production_plan_board_items
  add constraint production_plan_board_items_pcb_side_check
  check (pcb_side in ('SINGLE', 'TOP', 'BOT', 'BOTH'));

alter table public.production_plan_board_items
  drop constraint if exists production_plan_board_items_planned_quantity_check;

alter table public.production_plan_board_items
  add constraint production_plan_board_items_planned_quantity_check
  check (planned_quantity is null or planned_quantity > 0);

comment on column public.production_plan_board_items.planned_date is '확정 계획일 (KST)';
comment on column public.production_plan_board_items.line_no is 'SMT 라인 1~7 (scope=smt)';
comment on column public.production_plan_board_items.team is '후공정 팀 (scope=post)';
comment on column public.production_plan_board_items.pcb_side is 'SINGLE | TOP | BOT | BOTH(양면 동시)';
comment on column public.production_plan_board_items.planned_quantity is '확정 계획 수량';
