-- 견적서 상태 (미확정 / 확정)
-- Supabase SQL Editor에서 실행하세요.

alter table public.quotations
  add column if not exists status text not null default 'draft';

update public.quotations
set status = case
  when coalesce(detail_info #>> '{settings,quoteStatus}', '') = 'confirmed' then 'confirmed'
  else 'draft'
end
where status is distinct from case
  when coalesce(detail_info #>> '{settings,quoteStatus}', '') = 'confirmed' then 'confirmed'
  else 'draft'
end;

alter table public.quotations
  drop constraint if exists quotations_status_check;

alter table public.quotations
  add constraint quotations_status_check
  check (status in ('draft', 'confirmed'));

comment on column public.quotations.status is '견적 상태: draft(미확정) / confirmed(확정)';

create index if not exists quotations_status_idx on public.quotations (status);
