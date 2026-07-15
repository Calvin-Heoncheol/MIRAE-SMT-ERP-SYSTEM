-- Supabase SQL Editor에서 실행하세요
--
-- 영업관리 · 신규업체

create table if not exists public.new_company_inquiries (
  id uuid primary key default gen_random_uuid(),
  contact_name text not null default '',
  company_name text not null default '',
  email text not null default '',
  phone text not null default '',
  product text not null default '',
  quantity numeric(18, 3),
  note text not null default '',
  status text not null default 'received'
    check (status in ('received', 'consulting', 'quoting', 'converted', 'on_hold', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.new_company_inquiries is '영업관리 — 신규업체';
comment on column public.new_company_inquiries.contact_name is '담당자';
comment on column public.new_company_inquiries.company_name is '회사명';
comment on column public.new_company_inquiries.email is '이메일';
comment on column public.new_company_inquiries.phone is '연락처';
comment on column public.new_company_inquiries.product is '제품';
comment on column public.new_company_inquiries.quantity is '예상수량';
comment on column public.new_company_inquiries.note is '비고';
comment on column public.new_company_inquiries.status is '접수/상담중/견적중/거래전환/보류/종료';

create index if not exists new_company_inquiries_created_at_idx
  on public.new_company_inquiries (created_at desc);
create index if not exists new_company_inquiries_company_name_idx
  on public.new_company_inquiries (company_name);
create index if not exists new_company_inquiries_status_idx
  on public.new_company_inquiries (status);

alter table public.new_company_inquiries enable row level security;

drop policy if exists "new_company_inquiries public read" on public.new_company_inquiries;
create policy "new_company_inquiries public read"
  on public.new_company_inquiries for select using (true);

drop policy if exists "new_company_inquiries public insert" on public.new_company_inquiries;
create policy "new_company_inquiries public insert"
  on public.new_company_inquiries for insert with check (true);

drop policy if exists "new_company_inquiries public update" on public.new_company_inquiries;
create policy "new_company_inquiries public update"
  on public.new_company_inquiries for update using (true) with check (true);

drop policy if exists "new_company_inquiries public delete" on public.new_company_inquiries;
create policy "new_company_inquiries public delete"
  on public.new_company_inquiries for delete using (true);

create or replace function public.touch_new_company_inquiries_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.normalize_new_company_inquiry_row()
returns trigger
language plpgsql
as $$
begin
  new.contact_name := coalesce(trim(new.contact_name), '');
  new.company_name := coalesce(trim(new.company_name), '');
  new.email := coalesce(trim(new.email), '');
  new.phone := coalesce(trim(new.phone), '');
  new.product := coalesce(trim(new.product), '');
  new.note := coalesce(trim(new.note), '');
  new.status := lower(coalesce(trim(new.status), 'received'));
  if new.status not in ('received', 'consulting', 'quoting', 'converted', 'on_hold', 'closed') then
    new.status := 'received';
  end if;

  if new.company_name = '' then
    raise exception '회사명은 필수입니다.';
  end if;
  if new.contact_name = '' then
    raise exception '담당자는 필수입니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists new_company_inquiries_normalize_row on public.new_company_inquiries;
create trigger new_company_inquiries_normalize_row
  before insert or update on public.new_company_inquiries
  for each row
  execute function public.normalize_new_company_inquiry_row();

drop trigger if exists new_company_inquiries_updated_at on public.new_company_inquiries;
create trigger new_company_inquiries_updated_at
  before update on public.new_company_inquiries
  for each row
  execute function public.touch_new_company_inquiries_updated_at();
