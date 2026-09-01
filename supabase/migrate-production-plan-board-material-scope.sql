-- 생산계획 보드에 자재(material) scope 추가
-- Supabase SQL Editor에서 실행하세요.

alter table public.production_plan_board_items
  drop constraint if exists production_plan_board_items_scope_check;

alter table public.production_plan_board_items
  add constraint production_plan_board_items_scope_check
  check (scope in ('material', 'smt', 'post'));

alter table public.production_plan_board_items
  drop constraint if exists production_plan_board_scope_ref;

alter table public.production_plan_board_items
  add constraint production_plan_board_scope_ref check (
    (scope = 'material' and order_line_id is not null and assembly_group_id is null)
    or (scope = 'smt' and order_line_id is not null and assembly_group_id is null)
    or (scope = 'post' and assembly_group_id is not null and order_line_id is null)
  );

create unique index if not exists production_plan_board_material_line_uidx
  on public.production_plan_board_items (order_line_id)
  where scope = 'material' and order_line_id is not null;

comment on table public.production_plan_board_items is
  '생산계획 보드 — 자재·SMT·후공정 확정 배정. 미확정은 행 없음.';
