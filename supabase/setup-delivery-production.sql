-- Supabase SQL Editor에서 실행하세요 (setup-bom.sql 이후)
--
-- 출하입력: 조립 그룹(완제품 세트)별 출하(납품) 실적 기록
-- 출하번호(id) = MRS + YYMMDD (KST), 당일 2건째부터 MRS260706-02 형식

create table if not exists public.delivery_records (
  id text primary key,
  record_date date not null default (timezone('Asia/Seoul', now()))::date,
  assembly_group_id uuid not null references public.order_assembly_groups(id) on delete cascade,
  quantity integer not null check (quantity > 0),
  source text not null default 'manual' check (source in ('manual')),
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint delivery_records_id_mrs_format_check check (id ~ '^MRS[0-9]{6}(-[0-9]{2})?$')
);

comment on table public.delivery_records is '출하(납품) 실적 — 조립 그룹(완제품)별 등록 이력';
comment on column public.delivery_records.id is '출하번호 MRS260706 (INSERT 시 record_date 기준 자동 발급, 수정 불가)';
comment on column public.delivery_records.record_date is '기록일자 (KST)';
comment on column public.delivery_records.assembly_group_id is '주문 조립 그룹 FK (order_assembly_groups.id)';
comment on column public.delivery_records.quantity is '이번 등록 출하(납품) 수량';
comment on column public.delivery_records.source is 'manual=출하입력 화면';

create index if not exists delivery_records_assembly_group_id_idx
  on public.delivery_records (assembly_group_id);

create index if not exists delivery_records_record_date_idx
  on public.delivery_records (record_date desc);

create index if not exists delivery_records_created_at_idx
  on public.delivery_records (created_at desc);

drop view if exists public.delivery_totals;

create view public.delivery_totals as
select
  assembly_group_id,
  coalesce(sum(quantity), 0)::integer as total_quantity
from public.delivery_records
group by assembly_group_id;

comment on view public.delivery_totals is '출하 조립 그룹별 누적 납품 수량';

create or replace function public.generate_delivery_number(p_record_date date default (timezone('Asia/Seoul', now()))::date)
returns text
language plpgsql
as $$
declare
  date_part text;
  base text;
  max_seq integer;
begin
  date_part := to_char(p_record_date, 'YYMMDD');
  base := 'MRS' || date_part;

  select coalesce(max(
    case
      when id = base then 1
      when id ~ ('^' || base || '-[0-9]{2}$') then
        nullif(regexp_replace(id, '^' || base || '-', ''), '')::integer
      else 0
    end
  ), 0)
  into max_seq
  from public.delivery_records
  where id = base or id like base || '-%';

  if max_seq = 0 then
    return base;
  end if;

  return base || '-' || lpad((max_seq + 1)::text, 2, '0');
end;
$$;

comment on function public.generate_delivery_number(date) is '출하번호 자동 발급 — MRS+YYMMDD, 당일 중복 시 -02 접미';

grant execute on function public.generate_delivery_number(date) to anon, authenticated;

create or replace function public.delivery_records_set_id()
returns trigger
language plpgsql
as $$
begin
  if new.id is null or btrim(new.id) = '' then
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

alter table public.delivery_records enable row level security;

drop policy if exists "delivery_records public read" on public.delivery_records;
create policy "delivery_records public read"
  on public.delivery_records for select using (true);

drop policy if exists "delivery_records public insert" on public.delivery_records;
create policy "delivery_records public insert"
  on public.delivery_records for insert with check (true);

drop policy if exists "delivery_records public update" on public.delivery_records;
create policy "delivery_records public update"
  on public.delivery_records for update using (true) with check (true);

drop policy if exists "delivery_records public delete" on public.delivery_records;
create policy "delivery_records public delete"
  on public.delivery_records for delete using (true);

grant select on public.delivery_totals to anon, authenticated;
