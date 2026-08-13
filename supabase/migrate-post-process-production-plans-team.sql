-- Supabase SQL Editor에서 실행하세요
-- (setup-post-process-production-plans.sql 이후 — 이미 테이블이 있는 경우)
--
-- 후공정 생산계획에 팀(생산2~4팀) 구분 추가
-- 주문 후보는 공유, 계획표는 팀별

alter table public.post_process_production_plans
  add column if not exists team text not null default '생산2팀';

update public.post_process_production_plans
set team = '생산2팀'
where coalesce(trim(team), '') = '';

alter table public.post_process_production_plans
  drop constraint if exists post_process_production_plans_assembly_group_id_planned_date_key;

alter table public.post_process_production_plans
  drop constraint if exists post_process_production_plans_assembly_group_id_planned_date_team_key;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'post_process_production_plans_assembly_group_id_planned_date_team_key'
  ) then
    alter table public.post_process_production_plans
      add constraint post_process_production_plans_assembly_group_id_planned_date_team_key
      unique (assembly_group_id, planned_date, team);
  end if;
end $$;

comment on column public.post_process_production_plans.team is '생산팀 (생산2팀, 생산3팀, 생산4팀)';

create index if not exists post_process_production_plans_team_idx
  on public.post_process_production_plans (team);
