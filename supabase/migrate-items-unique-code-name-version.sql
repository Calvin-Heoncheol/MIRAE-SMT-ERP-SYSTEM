-- 품목 유니크: 품목코드 + 품명 + 버전
-- 같은 표시 코드라도 품명·버전이 다르면 각각 등록 가능
-- Supabase SQL Editor에서 실행 (멱등)

drop index if exists public.items_base_code_version_uidx;
drop index if exists public.items_base_code_name_version_uidx;

create unique index if not exists items_base_code_name_version_uidx
  on public.items (
    lower(btrim(base_code)),
    lower(btrim(name)),
    lower(btrim(version))
  );

comment on index public.items_base_code_name_version_uidx is
  '같은 품목코드·품명·버전 조합만 중복 금지. 코드만 같고 품명/버전이 다르면 허용';
