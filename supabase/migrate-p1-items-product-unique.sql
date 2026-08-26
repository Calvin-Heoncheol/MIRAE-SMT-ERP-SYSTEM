-- =============================================================================
-- P1: 반제품·조립제품 유니크 = 고객사 + 품목코드 + 버전 (품명 제외)
-- =============================================================================
-- 기존 items_base_code_name_version_uidx 는 품명이 다르면 같은 코드·버전 허용 →
-- 발주 검색 ambiguous. 반·조립은 (customer_id, base_code, version) 으로 좁힘.
-- 원자재(1)는 items_raw_material_base_code_uidx 유지.
-- 부자재(2)는 코드+품명+버전 유지.
--
-- Supabase SQL Editor에서 한 번 실행하세요.
-- 적용 전 중복이 있으면 인덱스가 실패합니다 — 아래 확인 쿼리를 먼저 실행하세요.
-- =============================================================================

-- 확인: 반·조립 중복 (고객사+코드+버전)
-- select coalesce(customer_id, ''), lower(btrim(base_code)), lower(btrim(version)), count(*)
-- from public.items
-- where item_category in (3, 4)
-- group by 1, 2, 3
-- having count(*) > 1;

drop index if exists public.items_base_code_name_version_uidx;

-- 부자재: 코드+품명+버전
create unique index if not exists items_sub_material_code_name_version_uidx
  on public.items (
    lower(btrim(base_code)),
    lower(btrim(name)),
    lower(btrim(version))
  )
  where item_category = 2;

-- 반제품·조립제품: 고객사+코드+버전 (품명 무관)
create unique index if not exists items_product_customer_code_version_uidx
  on public.items (
    coalesce(customer_id, ''),
    lower(btrim(base_code)),
    lower(btrim(version))
  )
  where item_category in (3, 4);

comment on index public.items_sub_material_code_name_version_uidx is
  '부자재: 품목코드+품명+버전 유일';
comment on index public.items_product_customer_code_version_uidx is
  '반제품·조립제품: 고객사+품목코드+버전 유일 (품명 달라도 동일 코드·버전 불가)';
