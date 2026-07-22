-- 신규업체: 상태를 4단계로 축소 + 유입경로 컬럼 추가
-- 접수 / 진행중 / 거래전환 / 종료
-- 구값 매핑: consulting,quoting → in_progress / on_hold → closed

alter table public.new_company_inquiries
  add column if not exists source_channel text not null default '';

comment on column public.new_company_inquiries.source_channel is
  '유입경로 (홈페이지, 소개, 박람회 등)';

update public.new_company_inquiries
set status = 'in_progress'
where status in ('consulting', 'quoting');

update public.new_company_inquiries
set status = 'closed'
where status = 'on_hold';

alter table public.new_company_inquiries
  drop constraint if exists new_company_inquiries_status_check;

alter table public.new_company_inquiries
  add constraint new_company_inquiries_status_check
  check (status in ('received', 'in_progress', 'converted', 'closed'));

comment on column public.new_company_inquiries.status is
  '접수/진행중/거래전환/종료';

create or replace function public.normalize_new_company_inquiry_row()
returns trigger
language plpgsql
as $fn$
begin
  new.contact_name := coalesce(trim(new.contact_name), '');
  new.company_name := coalesce(trim(new.company_name), '');
  new.email := coalesce(trim(new.email), '');
  new.phone := coalesce(trim(new.phone), '');
  new.product := coalesce(trim(new.product), '');
  new.note := coalesce(trim(new.note), '');
  new.source_channel := coalesce(trim(new.source_channel), '');
  new.status := lower(coalesce(trim(new.status), 'received'));

  if new.status in ('consulting', 'quoting') then
    new.status := 'in_progress';
  elsif new.status = 'on_hold' then
    new.status := 'closed';
  end if;

  if new.status not in ('received', 'in_progress', 'converted', 'closed') then
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
$fn$;
