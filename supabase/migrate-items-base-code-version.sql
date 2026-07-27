-- 품목코드(base_code)와 버전(version) 분리
-- - 같은 품목코드(ABC)에 버전 A1, A2 행을 각각 둘 수 있음
-- - items.id 는 내부 PK (기존 호환: ABC-A1 형태 유지)
-- Supabase SQL Editor에서 실행 (멱등)

alter table public.items
  add column if not exists base_code text not null default '';

alter table public.items
  add column if not exists version text not null default '';

comment on column public.items.base_code is '표시용 품목코드 (버전 제외). 예: ABC';
comment on column public.items.version is '버전 라벨. 예: A1, V2. 원자재는 빈 문자열';
comment on column public.items.id is '내부 품목 PK. 버전이 있으면 보통 {base_code}-{version}';

-- 기존 id 에서 base/version 백필 (이미 채워진 행은 유지)
update public.items
set
  base_code = coalesce(
    nullif(btrim(base_code), ''),
    case
      when id ~ '^.+-[A-Za-z][A-Za-z0-9]*$'
        then regexp_replace(id, '-[A-Za-z][A-Za-z0-9]*$', '')
      else id
    end
  ),
  version = coalesce(
    nullif(btrim(version), ''),
    case
      when id ~ '^.+-[A-Za-z][A-Za-z0-9]*$'
        then regexp_replace(id, '^.+-([A-Za-z][A-Za-z0-9]*)$', '\1')
      else ''
    end
  )
where btrim(coalesce(base_code, '')) = ''
   or (
     btrim(coalesce(version, '')) = ''
     and id ~ '^.+-[A-Za-z][A-Za-z0-9]*$'
   );

-- 안전망: base_code 비어 있으면 id 사용
update public.items
set base_code = id
where btrim(coalesce(base_code, '')) = '';

create index if not exists items_base_code_idx on public.items (base_code);

-- 같은 품목코드+버전 중복 방지 (대소문자·공백 무시)
drop index if exists items_base_code_version_uidx;
create unique index items_base_code_version_uidx
  on public.items (lower(btrim(base_code)), lower(btrim(version)));

-- 주문 라인 product_code 를 표시용 base_code 로 맞춤 (product_id 는 버전 행 유지)
update public.order_lines as ol
set product_code = nullif(btrim(i.base_code), '')
from public.items as i
where ol.product_id = i.id
  and nullif(btrim(i.base_code), '') is not null
  and ol.product_code is distinct from btrim(i.base_code);
