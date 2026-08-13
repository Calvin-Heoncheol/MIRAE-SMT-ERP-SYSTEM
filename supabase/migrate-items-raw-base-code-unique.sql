-- 원자재(item_category = 1): 품목코드(base_code) 유일
-- 반·조립제품은 코드+품명+버전 유니크(items_base_code_name_version_uidx) 유지
-- Supabase SQL Editor에서 실행 (멱등)

create unique index if not exists items_raw_material_base_code_uidx
  on public.items (lower(btrim(base_code)))
  where item_category = 1;

comment on index public.items_raw_material_base_code_uidx is
  '원자재는 품목코드(base_code)만으로 유일. 같은 코드의 원자재 중복 등록 금지';
