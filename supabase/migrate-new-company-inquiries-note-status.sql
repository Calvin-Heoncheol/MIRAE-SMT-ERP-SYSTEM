-- 이미 setup을 실행한 DB용 (inquiry_content → note, status 추가)

alter table public.new_company_inquiries
  add column if not exists note text not null default '';

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'new_company_inquiries'
      and column_name = 'inquiry_content'
  ) then
    execute $q$
      update public.new_company_inquiries
      set note = coalesce(nullif(trim(note), ''), coalesce(inquiry_content, ''))
      where coalesce(trim(note), '') = ''
    $q$;
    alter table public.new_company_inquiries drop column inquiry_content;
  end if;
end $$;

alter table public.new_company_inquiries
  add column if not exists status text not null default 'received';

alter table public.new_company_inquiries
  drop constraint if exists new_company_inquiries_status_check;

alter table public.new_company_inquiries
  add constraint new_company_inquiries_status_check
  check (status in ('received', 'consulting', 'quoting', 'converted', 'on_hold', 'closed'));

comment on column public.new_company_inquiries.note is '진행사항 (한 줄씩 기록)';
comment on column public.new_company_inquiries.status is '접수/상담중/견적중/거래전환/보류/종료';
comment on column public.new_company_inquiries.quantity is '예상수량';
comment on column public.new_company_inquiries.contact_name is '담당자';

create index if not exists new_company_inquiries_status_idx
  on public.new_company_inquiries (status);

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
