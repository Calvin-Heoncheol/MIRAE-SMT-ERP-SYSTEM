-- 입고 유형 opening(기초) 제거
-- Supabase SQL Editor에서 실행하세요.

-- 1) 기존 기초 입고 → 사급으로 전환
update public.material_inbound_records
set inbound_type = 'supplied',
    updated_at = timezone('Asia/Seoul', now())
where inbound_type = 'opening';

-- 2) check 제약 교체 (opening 제거)
do $$
declare
  constraint_name text;
begin
  select con.conname into constraint_name
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_namespace nsp on nsp.oid = rel.relnamespace
  where nsp.nspname = 'public'
    and rel.relname = 'material_inbound_records'
    and con.contype = 'c'
    and pg_get_constraintdef(con.oid) ilike '%inbound_type%'
    and pg_get_constraintdef(con.oid) ilike '%opening%'
  limit 1;

  if constraint_name is not null then
    execute format('alter table public.material_inbound_records drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.material_inbound_records
  add constraint material_inbound_records_inbound_type_check
  check (inbound_type in ('purchase', 'supplied', 'return'));

comment on column public.material_inbound_records.inbound_type is 'purchase=발주, supplied=사급, return=반품';
