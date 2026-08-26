-- DANGER — 운영에서 실행 금지. 원자재 supply_type 을 전부 사급으로 덮어씀.
-- 실행하려면 아래 줄을 삭제하세요: select 1/0;
select 1/0; -- safety stop

-- =============================================================================
-- 아래는 의도적으로 실행되지 않습니다 (위 safety stop 삭제 후에만 검토).
-- =============================================================================

-- 품목등록: 원자재(item_category=1) 도급/사급을 전부 '사급'으로 채움
-- Supabase SQL Editor에서 실행하세요.
-- 반제품·조립제품·부자재는 건드리지 않습니다.

-- 실행 전 확인
-- select
--   count(*) as raw_item_count,
--   count(*) filter (where coalesce(trim(supply_type), '') = '사급') as already_sagup,
--   count(*) filter (where coalesce(trim(supply_type), '') is distinct from '사급') as will_update
-- from public.items
-- where item_category = 1;

-- 일괄 반영
-- update public.items
-- set
--   supply_type = '사급',
--   updated_at = now()
-- where item_category = 1
--   and coalesce(trim(supply_type), '') is distinct from '사급';

-- 실행 후 확인
-- select
--   count(*) as raw_item_count,
--   count(*) filter (where trim(supply_type) = '사급') as sagup_count
-- from public.items
-- where item_category = 1;
