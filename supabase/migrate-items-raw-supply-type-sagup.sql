-- 품목등록: 원자재(item_category=1) 도급/사급을 전부 '사급'으로 채움
-- Supabase SQL Editor에서 실행하세요.
-- 반제품·조립제품·부자재는 건드리지 않습니다.

-- 실행 전 확인
select
  count(*) as raw_item_count,
  count(*) filter (where coalesce(trim(supply_type), '') = '사급') as already_sagup,
  count(*) filter (where coalesce(trim(supply_type), '') is distinct from '사급') as will_update
from public.items
where item_category = 1;

-- 일괄 반영
update public.items
set
  supply_type = '사급',
  updated_at = now()
where item_category = 1
  and coalesce(trim(supply_type), '') is distinct from '사급';

-- 실행 후 확인
select
  count(*) as raw_item_count,
  count(*) filter (where trim(supply_type) = '사급') as sagup_count
from public.items
where item_category = 1;
