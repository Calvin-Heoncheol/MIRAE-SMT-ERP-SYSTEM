-- Supabase SQL Editor에서 실행하세요
--
-- 휴가원 마스터 — 문서번호 MRL-0001

create table if not exists public.leave_requests (
  id text primary key,
  doc_number text not null,
  written_date date not null default current_date,
  department text not null default '관리부',
  position text not null default '',
  author text not null default '',
  leave_type text not null default 'annual' check (
    leave_type in (
      'annual',
      'congratulatory',
      'sick',
      'early_leave',
      'absence',
      'other'
    )
  ),
  start_date date,
  start_time text not null default '',
  end_date date,
  end_time text not null default '',
  reason text not null default '',
  detail_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_id_mrl_format_check check (id ~ '^MRL-[0-9]+$'),
  constraint leave_requests_doc_number_mrl_format_check check (doc_number ~ '^MRL-[0-9]+$')
);

comment on table public.leave_requests is '휴가원 마스터 — 문서번호 MRL-0001';
comment on column public.leave_requests.id is '문서코드 MRL-0001 (INSERT 시 자동 발급, 수정 불가)';
comment on column public.leave_requests.doc_number is '문서번호 MRL-0001 (id와 동일, INSERT 시 자동 발급)';
comment on column public.leave_requests.written_date is '제출일';
comment on column public.leave_requests.position is '직위';
comment on column public.leave_requests.leave_type is '연차/경조/병가/조퇴/결근/기타';
comment on column public.leave_requests.detail_info is '결재·특이사항 등 JSON';

create index if not exists leave_requests_written_date_idx on public.leave_requests (written_date desc);
create index if not exists leave_requests_doc_number_idx on public.leave_requests (doc_number);
create unique index if not exists leave_requests_doc_number_unique_idx on public.leave_requests (doc_number);

alter table public.leave_requests enable row level security;

drop policy if exists "leave_requests public read" on public.leave_requests;
create policy "leave_requests public read"
  on public.leave_requests for select
  using (true);

drop policy if exists "leave_requests public insert" on public.leave_requests;
create policy "leave_requests public insert"
  on public.leave_requests for insert
  with check (true);

drop policy if exists "leave_requests public update" on public.leave_requests;
create policy "leave_requests public update"
  on public.leave_requests for update
  using (true)
  with check (true);

drop policy if exists "leave_requests public delete" on public.leave_requests;
create policy "leave_requests public delete"
  on public.leave_requests for delete
  using (true);

create or replace function public.touch_leave_requests_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_leave_request_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRL-', ''), '')::integer
  ), 0)
  into max_num
  from public.leave_requests
  where id ~ '^MRL-[0-9]+$';

  next_num := max_num + 1;
  return 'MRL-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_leave_request_code() to anon, authenticated;

create or replace function public.normalize_leave_requests_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_leave_request_code();
    end if;
    if new.doc_number is null or trim(new.doc_number) = '' then
      new.doc_number := new.id;
    end if;
  elsif tg_op = 'UPDATE' then
    if new.id is distinct from old.id then
      new.id := old.id;
    end if;
    if new.doc_number is null or trim(new.doc_number) = '' then
      new.doc_number := old.doc_number;
    end if;
  end if;

  new.department := coalesce(trim(new.department), '관리부');
  new.position := coalesce(trim(new.position), '');
  new.author := coalesce(trim(new.author), '');
  new.reason := coalesce(trim(new.reason), '');
  new.start_time := coalesce(trim(new.start_time), '');
  new.end_time := coalesce(trim(new.end_time), '');
  return new;
end;
$$;

drop trigger if exists leave_requests_normalize_row on public.leave_requests;
create trigger leave_requests_normalize_row
  before insert or update on public.leave_requests
  for each row
  execute function public.normalize_leave_requests_row();

drop trigger if exists leave_requests_updated_at on public.leave_requests;
create trigger leave_requests_updated_at
  before update on public.leave_requests
  for each row
  execute function public.touch_leave_requests_updated_at();
