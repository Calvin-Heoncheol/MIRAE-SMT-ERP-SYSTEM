-- 회사 내부 공지 (대시보드 공지 섹션)
-- Supabase SQL Editor에서 실행하세요.
-- 전제: migrate-rls-authenticated-writes.sql 의 is_profile_manager_or_admin() 적용됨

create table if not exists public.company_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null default '',
  body text not null default '',
  is_pinned boolean not null default false,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.company_notices is '회사 내부 공지 (대시보드 홈)';
comment on column public.company_notices.title is '공지 제목';
comment on column public.company_notices.body is '본문 (평문)';
comment on column public.company_notices.is_pinned is '상단 고정';

create index if not exists company_notices_list_idx
  on public.company_notices (is_pinned desc, created_at desc);

alter table public.company_notices enable row level security;

drop policy if exists company_notices_select_public on public.company_notices;
drop policy if exists company_notices_insert_manager on public.company_notices;
drop policy if exists company_notices_update_manager on public.company_notices;
drop policy if exists company_notices_delete_manager on public.company_notices;

-- RSC 홈 조회 호환: 공개 읽기
create policy company_notices_select_public
  on public.company_notices
  for select
  using (true);

-- 작성·수정·삭제는 팀장(manager) 이상
create policy company_notices_insert_manager
  on public.company_notices
  for insert
  to authenticated
  with check (public.is_profile_manager_or_admin());

create policy company_notices_update_manager
  on public.company_notices
  for update
  to authenticated
  using (public.is_profile_manager_or_admin())
  with check (public.is_profile_manager_or_admin());

create policy company_notices_delete_manager
  on public.company_notices
  for delete
  to authenticated
  using (public.is_profile_manager_or_admin());
