-- 기존 DB: 입고 유형 other → supplied, 체크 제약 갱신
-- Supabase SQL Editor에서 실행하세요 (setup-material-inbound.sql 적용 후)

update public.material_inbound_records
set inbound_type = 'supplied'
where inbound_type = 'other';

alter table public.material_inbound_records
  drop constraint if exists material_inbound_records_inbound_type_check;

alter table public.material_inbound_records
  add constraint material_inbound_records_inbound_type_check
  check (inbound_type in ('opening', 'purchase', 'supplied', 'return'));

alter table public.material_inbound_records
  alter column inbound_type set default 'supplied';

comment on column public.material_inbound_records.inbound_type is 'opening=기초, purchase=발주, supplied=사급, return=반품';
