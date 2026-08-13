-- 견적서 최종 수정자 컬럼
-- Supabase SQL Editor에서 실행하세요.

alter table public.quotations
  add column if not exists updated_by uuid references auth.users (id) on delete set null;

alter table public.quotations
  add column if not exists updated_by_name text not null default '';

comment on column public.quotations.updated_by is '최종 수정자 auth.users.id';
comment on column public.quotations.updated_by_name is '최종 수정자 표시명 스냅샷';

create index if not exists quotations_updated_by_idx on public.quotations (updated_by);
