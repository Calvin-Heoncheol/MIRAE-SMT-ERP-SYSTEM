-- 생산계획: 종료일 + 가계획/확정
-- Supabase SQL Editor에서 실행하세요.

-- SMT
alter table public.smt_production_plans
  add column if not exists planned_end_date date;

alter table public.smt_production_plans
  add column if not exists plan_status text not null default 'confirmed';

update public.smt_production_plans
set planned_end_date = planned_date
where planned_end_date is null;

alter table public.smt_production_plans
  alter column planned_end_date set default null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'smt_production_plans_plan_status_check'
  ) then
    alter table public.smt_production_plans
      add constraint smt_production_plans_plan_status_check
      check (plan_status in ('draft', 'confirmed'));
  end if;
end $$;

comment on column public.smt_production_plans.planned_date is 'SMT 시작일 (KST)';
comment on column public.smt_production_plans.planned_end_date is 'SMT 종료일 (없으면 시작일과 동일)';
comment on column public.smt_production_plans.plan_status is 'draft=가계획, confirmed=확정';

-- 후공정
alter table public.post_process_production_plans
  add column if not exists planned_end_date date;

alter table public.post_process_production_plans
  add column if not exists plan_status text not null default 'confirmed';

update public.post_process_production_plans
set planned_end_date = planned_date
where planned_end_date is null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'post_process_production_plans_plan_status_check'
  ) then
    alter table public.post_process_production_plans
      add constraint post_process_production_plans_plan_status_check
      check (plan_status in ('draft', 'confirmed'));
  end if;
end $$;

comment on column public.post_process_production_plans.planned_date is '후공정 시작일 (KST)';
comment on column public.post_process_production_plans.planned_end_date is '후공정 종료일 (없으면 시작일과 동일)';
comment on column public.post_process_production_plans.plan_status is 'draft=가계획, confirmed=확정';
