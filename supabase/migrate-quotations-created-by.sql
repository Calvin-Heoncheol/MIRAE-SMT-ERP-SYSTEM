-- 견적서 등록자 컬럼 (기존 DB용)
-- migrate-created-by-high-med.sql 을 이미 실행했다면 생략입니다.

alter table public.quotations
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.quotations
  add column if not exists created_by_name text not null default '';

comment on column public.quotations.created_by is '등록자 auth.users.id';
comment on column public.quotations.created_by_name is '등록자 표시명 스냅샷 (profiles.display_name)';

create index if not exists quotations_created_by_idx on public.quotations (created_by);
