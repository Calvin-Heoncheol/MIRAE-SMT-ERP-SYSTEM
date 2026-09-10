-- 출하 추가작업·자재 / 수동 고객사 — note HTML 마커에서 컬럼으로 정규화
-- 기존 <!--SHIP_EXTRA:--> / <!--SHIP_CUSTOMER:--> 는 앱 읽기 폴백으로 유지
-- Supabase SQL Editor에서 실행하세요.

alter table public.delivery_records
  add column if not exists extra_lines jsonb not null default '[]'::jsonb;

alter table public.delivery_records
  add column if not exists ship_customer text not null default '';

comment on column public.delivery_records.extra_lines is
  '출하 명세서 수동 추가작업·자재 JSON 배열 [{productCode,productName,qty,unitPrice,lineKind,orderNumber?}]';

comment on column public.delivery_records.ship_customer is
  '발주 없이 추가작업·자재만 출하할 때 명세 고객사 (assembly_group_id null)';

alter table public.delivery_records
  drop constraint if exists delivery_records_extra_lines_is_array;

alter table public.delivery_records
  add constraint delivery_records_extra_lines_is_array
  check (jsonb_typeof(extra_lines) = 'array');
