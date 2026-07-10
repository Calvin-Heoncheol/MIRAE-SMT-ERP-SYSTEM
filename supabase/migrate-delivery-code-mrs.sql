-- Supabase SQL Editor에서 실행하세요
-- 출하번호: uuid 또는 MRS260706 → MRS-0001 순번 형식으로 통일

-- 1) id 가 uuid 인 레거시 테이블이면 text 로 변환
do $$
declare
  col_type text;
begin
  select c.data_type
  into col_type
  from information_schema.columns as c
  where c.table_schema = 'public'
    and c.table_name = 'delivery_records'
    and c.column_name = 'id';

  if col_type = 'uuid' then
    drop view if exists public.delivery_totals cascade;
    drop trigger if exists delivery_records_set_id on public.delivery_records;

    alter table public.delivery_records
      drop constraint if exists delivery_records_id_mrs_format_check;

    alter table public.delivery_records add column id_text text;

    update public.delivery_records as records
    set id_text = mapping.new_id
    from (
      select
        id,
        'MRS-' || lpad(row_number() over (order by created_at, id)::text, 4, '0') as new_id
      from public.delivery_records
    ) as mapping
    where records.id = mapping.id;

    alter table public.delivery_records drop constraint delivery_records_pkey;
    alter table public.delivery_records drop column id;
    alter table public.delivery_records rename column id_text to id;
    alter table public.delivery_records alter column id set not null;
    alter table public.delivery_records add primary key (id);
  end if;
end $$;

-- 2) text 이지만 MRS-0001 형식이 아닌 기존 번호 변환
alter table public.delivery_records
  drop constraint if exists delivery_records_id_mrs_format_check;

create temp table if not exists _delivery_id_map (
  old_id text primary key,
  new_id text not null unique
) on commit drop;

truncate _delivery_id_map;

insert into _delivery_id_map (old_id, new_id)
select
  records.id,
  'MRS-' || lpad(
    (
      coalesce((
        select max(nullif(regexp_replace(existing.id, '^MRS-', ''), '')::integer)
        from public.delivery_records as existing
        where existing.id ~ '^MRS-[0-9]+$'
      ), 0)
      + row_number() over (order by records.created_at, records.id)
    )::text,
    4,
    '0'
  )
from public.delivery_records as records
where records.id !~ '^MRS-[0-9]+$';

update public.delivery_records as records
set id = mapping.new_id
from _delivery_id_map as mapping
where records.id = mapping.old_id;

alter table public.delivery_records
  add constraint delivery_records_id_mrs_format_check
  check (id ~ '^MRS-[0-9]+$');

comment on table public.delivery_records is '출하(납품) 실적 — MRS-0001';
comment on column public.delivery_records.id is '출하번호 MRS-0001 (INSERT 시 자동 발급, 수정 불가)';

-- 3) 자동발급 함수·트리거·뷰
create or replace function public.generate_delivery_number(p_record_date date default (timezone('Asia/Seoul', now()))::date)
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRS-', ''), '')::integer
  ), 0)
  into max_num
  from public.delivery_records
  where id ~ '^MRS-[0-9]+$';

  next_num := max_num + 1;
  return 'MRS-' || lpad(next_num::text, 4, '0');
end;
$$;

comment on function public.generate_delivery_number(date) is '출하번호 자동 발급 — MRS-0001 순번';

grant execute on function public.generate_delivery_number(date) to anon, authenticated;

create or replace function public.delivery_records_set_id()
returns trigger
language plpgsql
as $$
begin
  if coalesce(btrim(new.id::text), '') = '' then
    new.id := public.generate_delivery_number(new.record_date);
  end if;
  return new;
end;
$$;

drop trigger if exists delivery_records_set_id on public.delivery_records;
create trigger delivery_records_set_id
  before insert on public.delivery_records
  for each row
  execute function public.delivery_records_set_id();

drop view if exists public.delivery_totals;

create view public.delivery_totals as
select
  assembly_group_id,
  coalesce(sum(quantity), 0)::integer as total_quantity
from public.delivery_records
group by assembly_group_id;

comment on view public.delivery_totals is '출하 조립 그룹별 누적 납품 수량';

grant select on public.delivery_totals to anon, authenticated;
