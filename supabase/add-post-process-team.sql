-- Supabase SQL Editor에서 실행하세요 (setup-post-process-production.sql 이후)
-- 후공정 생산기록에 생산팀(생산2~4팀) 구분 컬럼 추가

alter table public.post_process_production_records
  add column if not exists team text not null default '';

comment on column public.post_process_production_records.team is '생산팀 (생산2팀, 생산3팀, 생산4팀)';

create index if not exists post_process_production_records_team_idx
  on public.post_process_production_records (team)
  where team <> '';
