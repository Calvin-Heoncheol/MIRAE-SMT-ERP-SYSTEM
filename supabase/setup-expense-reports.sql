-- Supabase SQL Editor에서 실행하세요
--
-- 지출결의서 마스터 — 문서번호 MRD-0001

create table if not exists public.expense_reports (
  id text primary key,
  doc_number text not null,
  written_date date not null default current_date,
  department text not null default '관리부',
  author text not null default '',
  account_category text not null default '',
  processing_details text not null default '',
  approval_date date,
  expenditure_date date,
  recipient text not null default '',
  receipt_date date,
  total_amount numeric not null default 0 check (total_amount >= 0),
  detail_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint expense_reports_id_mrd_format_check check (id ~ '^MRD-[0-9]+$'),
  constraint expense_reports_doc_number_mrd_format_check check (doc_number ~ '^MRD-[0-9]+$')
);

comment on table public.expense_reports is '지출결의서 마스터 — 문서번호 MRD-0001';
comment on column public.expense_reports.id is '문서코드 MRD-0001 (INSERT 시 자동 발급, 수정 불가)';
comment on column public.expense_reports.doc_number is '문서번호 MRD-0001 (id와 동일, INSERT 시 자동 발급)';
comment on column public.expense_reports.written_date is '발의일';
comment on column public.expense_reports.author is '정리인';
comment on column public.expense_reports.account_category is '계정과목';
comment on column public.expense_reports.processing_details is '처리사항';
comment on column public.expense_reports.approval_date is '결재일';
comment on column public.expense_reports.expenditure_date is '지출일';
comment on column public.expense_reports.recipient is '영수자';
comment on column public.expense_reports.receipt_date is '영수일';
comment on column public.expense_reports.detail_info is '내역·첨부·결재 등 JSON';

create index if not exists expense_reports_written_date_idx on public.expense_reports (written_date desc);
create index if not exists expense_reports_doc_number_idx on public.expense_reports (doc_number);
create unique index if not exists expense_reports_doc_number_unique_idx on public.expense_reports (doc_number);

alter table public.expense_reports enable row level security;

drop policy if exists "expense_reports public read" on public.expense_reports;
create policy "expense_reports public read"
  on public.expense_reports for select
  using (true);

drop policy if exists "expense_reports public insert" on public.expense_reports;
create policy "expense_reports public insert"
  on public.expense_reports for insert
  with check (true);

drop policy if exists "expense_reports public update" on public.expense_reports;
create policy "expense_reports public update"
  on public.expense_reports for update
  using (true)
  with check (true);

drop policy if exists "expense_reports public delete" on public.expense_reports;
create policy "expense_reports public delete"
  on public.expense_reports for delete
  using (true);

create or replace function public.touch_expense_reports_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_expense_report_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRD-', ''), '')::integer
  ), 0)
  into max_num
  from public.expense_reports
  where id ~ '^MRD-[0-9]+$';

  next_num := max_num + 1;
  return 'MRD-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_expense_report_code() to anon, authenticated;

create or replace function public.normalize_expense_reports_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_expense_report_code();
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
  new.account_category := coalesce(trim(new.account_category), '');
  new.processing_details := coalesce(trim(new.processing_details), '');
  new.recipient := coalesce(trim(new.recipient), '');
  return new;
end;
$$;

drop trigger if exists expense_reports_normalize_row on public.expense_reports;
create trigger expense_reports_normalize_row
  before insert or update on public.expense_reports
  for each row
  execute function public.normalize_expense_reports_row();

drop trigger if exists expense_reports_updated_at on public.expense_reports;
create trigger expense_reports_updated_at
  before update on public.expense_reports
  for each row
  execute function public.touch_expense_reports_updated_at();
