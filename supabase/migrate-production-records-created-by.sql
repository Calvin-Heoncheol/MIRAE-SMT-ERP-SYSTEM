-- 생산 실적 등록자(로그인 사용자) 추적
-- smt_production_records / post_process_production_records

alter table public.smt_production_records
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.smt_production_records
  add column if not exists created_by_name text not null default '';

comment on column public.smt_production_records.created_by is '등록자 auth.users.id';
comment on column public.smt_production_records.created_by_name is '등록자 표시명 스냅샷 (profiles.display_name)';

create index if not exists smt_production_records_created_by_idx
  on public.smt_production_records (created_by);

alter table public.post_process_production_records
  add column if not exists created_by uuid references auth.users (id) on delete set null;

alter table public.post_process_production_records
  add column if not exists created_by_name text not null default '';

comment on column public.post_process_production_records.created_by is '등록자 auth.users.id';
comment on column public.post_process_production_records.created_by_name is '등록자 표시명 스냅샷 (profiles.display_name)';

create index if not exists post_process_production_records_created_by_idx
  on public.post_process_production_records (created_by);
