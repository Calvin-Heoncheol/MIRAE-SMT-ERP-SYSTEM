-- 반제품(item_category=3) 단가 현황 점검 — Supabase SQL Editor에서 실행
--
-- 컬럼 설명:
--   setup_unit_price   SET-UP (발주 1회)
--   smd_unit_price     SMD 대당
--   dip_unit_price     후공정 대당
--   material_unit_price 자재 대당
--   unit_price         레거시 대당 합계 (SMD+후공정)
--   other_unit_price   레거시 SET-UP (setup_unit_price 이전)
--   baseline_quote_id  연결 견적서 — 재동기화 시 참고

-- 1) 반제품 단가 요약
select
  count(*) as total,
  count(*) filter (
    where coalesce(setup_unit_price, 0)
      + coalesce(smd_unit_price, 0)
      + coalesce(dip_unit_price, 0)
      + coalesce(material_unit_price, 0) > 0
  ) as has_breakdown,
  count(*) filter (
    where coalesce(setup_unit_price, 0)
      + coalesce(smd_unit_price, 0)
      + coalesce(dip_unit_price, 0)
      + coalesce(material_unit_price, 0) = 0
      and (
        coalesce(unit_price, 0) > 0
        or coalesce(other_unit_price, 0) > 0
      )
  ) as legacy_only,
  count(*) filter (
    where coalesce(setup_unit_price, 0)
      + coalesce(smd_unit_price, 0)
      + coalesce(dip_unit_price, 0)
      + coalesce(material_unit_price, 0)
      + coalesce(unit_price, 0)
      + coalesce(other_unit_price, 0) = 0
  ) as all_zero
from public.items
where item_category = 3
  and is_active = true;

-- 2) 단가가 0으로 보이는 반제품 목록 (복구 후보)
select
  id,
  name,
  baseline_quote_id,
  setup_unit_price,
  smd_unit_price,
  dip_unit_price,
  material_unit_price,
  unit_price,
  other_unit_price,
  coalesce(setup_unit_price, 0)
    + coalesce(smd_unit_price, 0)
    + coalesce(dip_unit_price, 0)
    + coalesce(material_unit_price, 0) as breakdown_sum,
  coalesce(other_unit_price, 0) + coalesce(unit_price, 0) as legacy_sum
from public.items
where item_category = 3
  and is_active = true
order by name, id;

-- 3) [선택] other_unit_price → setup_unit_price 복구 (setup이 0이고 other만 있는 경우)
-- update public.items
-- set setup_unit_price = other_unit_price,
--     updated_at = now()
-- where item_category = 3
--   and coalesce(setup_unit_price, 0) = 0
--   and coalesce(other_unit_price, 0) > 0;

-- 4) [선택] 변경 이력에서 이전 단가 확인 (대시보드 변경사항과 동일 소스)
-- select
--   changed_at,
--   entity_id,
--   title,
--   detail,
--   before_data->>'setupUnitPrice' as before_setup,
--   before_data->>'smdUnitPrice' as before_smd,
--   before_data->>'dipUnitPrice' as before_dip,
--   before_data->>'materialUnitPrice' as before_material,
--   before_data->>'unitPrice' as before_unit
-- from public.entity_change_logs
-- where entity_type = 'item'
-- order by changed_at desc
-- limit 50;
