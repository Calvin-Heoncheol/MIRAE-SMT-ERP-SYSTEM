-- Supabase SQL Editor에서 실행하세요
-- 입고번호 형식 MRI-YYMMDD → MRIB-0001 순번 형식으로 변경 (기존 DB용)

alter table public.material_inbound_records
  drop constraint if exists material_inbound_records_id_format_check;

alter table public.material_inbound_lines
  drop constraint if exists material_inbound_lines_inbound_id_fkey;

create temp table if not exists _material_inbound_id_map (
  old_id text primary key,
  new_id text not null unique
) on commit drop;

truncate _material_inbound_id_map;

insert into _material_inbound_id_map (old_id, new_id)
select
  records.id,
  'MRIB-' || lpad(
    (
      coalesce((
        select max(nullif(regexp_replace(existing.id, '^MRIB-', ''), '')::integer)
        from public.material_inbound_records as existing
        where existing.id ~ '^MRIB-[0-9]+$'
      ), 0)
      + row_number() over (order by records.created_at, records.id)
    )::text,
    4,
    '0'
  )
from public.material_inbound_records as records
where records.id !~ '^MRIB-[0-9]+$';

update public.material_inbound_lines as lines
set inbound_id = mapping.new_id
from _material_inbound_id_map as mapping
where lines.inbound_id = mapping.old_id;

update public.material_inbound_records as records
set id = mapping.new_id
from _material_inbound_id_map as mapping
where records.id = mapping.old_id;

alter table public.material_inbound_lines
  add constraint material_inbound_lines_inbound_id_fkey
  foreign key (inbound_id) references public.material_inbound_records(id) on delete cascade;

alter table public.material_inbound_records
  add constraint material_inbound_records_id_format_check
  check (id ~ '^MRIB-[0-9]+$');

comment on table public.material_inbound_records is '자재 입고 전표 — MRIB-0001';
comment on column public.material_inbound_records.id is '입고번호 MRIB-0001 (INSERT 시 자동 발급, 수정 불가)';

create or replace function public.generate_material_inbound_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRIB-', ''), '')::integer
  ), 0)
  into max_num
  from public.material_inbound_records
  where id ~ '^MRIB-[0-9]+$';

  next_num := max_num + 1;
  return 'MRIB-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_material_inbound_code() to anon, authenticated;
