-- Supabase SQL Editor에서 실행하세요
--
-- 품의서 마스터 — 품의코드 id(MRA-0001), 문서번호 doc_number(MRA-0001, id와 동일)

create table if not exists public.approvals (
  id text primary key,
  category text not null check (
    category in ('raw-materials', 'sub-materials', 'equipment', 'facilities', 'misc')
  ),
  doc_number text not null,
  written_date date not null default current_date,
  department text not null default '관리부',
  retention_period text not null default '1년',
  author text not null default '',
  processing_date text not null default '결재 후 즉시',
  subject text not null default '',
  intro_body text not null default '',
  total_amount numeric not null default 0 check (total_amount >= 0),
  detail_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint approvals_id_mra_format_check check (id ~ '^MRA-[0-9]+$'),
  constraint approvals_doc_number_mra_format_check check (doc_number ~ '^MRA-[0-9]+$')
);

comment on table public.approvals is '품의서 마스터 — 품의코드·문서번호 MRA-0001';
comment on column public.approvals.id is '품의코드 MRA-0001 (INSERT 시 자동 발급, 수정 불가)';
comment on column public.approvals.doc_number is '문서번호 MRA-0001 (id와 동일, INSERT 시 자동 발급)';
comment on column public.approvals.category is '원자재/부자재/장비/설비/기타';
comment on column public.approvals.detail_info is '상세내역·결제방법·첨부서류 등 JSON';

create index if not exists approvals_written_date_idx on public.approvals (written_date desc);
create index if not exists approvals_category_idx on public.approvals (category);
create index if not exists approvals_doc_number_idx on public.approvals (doc_number);
create unique index if not exists approvals_doc_number_unique_idx on public.approvals (doc_number);

alter table public.approvals enable row level security;

drop policy if exists "approvals public read" on public.approvals;
create policy "approvals public read"
  on public.approvals for select
  using (true);

drop policy if exists "approvals public insert" on public.approvals;
create policy "approvals public insert"
  on public.approvals for insert
  with check (true);

drop policy if exists "approvals public update" on public.approvals;
create policy "approvals public update"
  on public.approvals for update
  using (true)
  with check (true);

drop policy if exists "approvals public delete" on public.approvals;
create policy "approvals public delete"
  on public.approvals for delete
  using (true);

create or replace function public.touch_approvals_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_approval_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRA-', ''), '')::integer
  ), 0)
  into max_num
  from public.approvals
  where id ~ '^MRA-[0-9]+$';

  next_num := max_num + 1;
  return 'MRA-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_approval_code() to anon, authenticated;

create or replace function public.normalize_approvals_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_approval_code();
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
  new.author := coalesce(trim(new.author), '');
  new.subject := coalesce(trim(new.subject), '');
  new.intro_body := coalesce(trim(new.intro_body), '');
  return new;
end;
$$;

drop trigger if exists approvals_normalize_row on public.approvals;
create trigger approvals_normalize_row
  before insert or update on public.approvals
  for each row
  execute function public.normalize_approvals_row();

drop trigger if exists approvals_updated_at on public.approvals;
create trigger approvals_updated_at
  before update on public.approvals
  for each row
  execute function public.touch_approvals_updated_at();
