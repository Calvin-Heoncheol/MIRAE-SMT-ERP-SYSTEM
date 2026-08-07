-- =============================================================================
-- entity_change_logs: INSERT 는 로그인(authenticated)만 (SELECT 공개 유지)
-- =============================================================================
-- RSC 홈 변경사항 피드는 anon SELECT 가 필요하므로 SELECT 는 using(true) 유지.
-- 위조·스팸 INSERT 만 차단합니다.
--
-- Supabase SQL Editor에서 한 번 실행하세요.
-- =============================================================================

alter table public.entity_change_logs enable row level security;

drop policy if exists "entity_change_logs public insert" on public.entity_change_logs;
drop policy if exists entity_change_logs_insert_auth on public.entity_change_logs;

-- SELECT 공개 (없으면 복구)
drop policy if exists "entity_change_logs public read" on public.entity_change_logs;
drop policy if exists entity_change_logs_select_auth on public.entity_change_logs;
create policy "entity_change_logs public read"
  on public.entity_change_logs
  for select
  using (true);

create policy entity_change_logs_insert_auth
  on public.entity_change_logs
  for insert
  to authenticated
  with check (auth.uid() is not null);

comment on table public.entity_change_logs is
  '변경이력 — SELECT 공개 / INSERT authenticated';
