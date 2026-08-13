-- 품목등록: 도급/사급 = '사급' 인 품목의 공급사를 '서창'으로 일괄 변경
-- Supabase SQL Editor에서 실행

update public.items
set
  supplier = '서창',
  updated_at = now()
where trim(supply_type) = '사급';
