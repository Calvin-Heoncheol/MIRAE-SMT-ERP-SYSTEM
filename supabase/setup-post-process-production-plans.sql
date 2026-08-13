-- Supabase SQL Editor에서 실행하세요
-- (setup-orders.sql, setup-bom.sql, setup-post-process-production.sql 이후)
--
-- 후공정 생산계획: 조립 그룹·일자·팀 배치 (SMT 라인 없음)
-- 주문 후보는 공유, 계획표는 팀(생산2~4)별

create table if not exists public.post_process_production_plans (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  assembly_group_id uuid not null references public.order_assembly_groups(id) on delete cascade,
  planned_date date not null,
  planned_end_date date,
  plan_status text not null default 'confirmed' check (plan_status in ('draft', 'confirmed')),
  team text not null default '생산2팀' check (team in ('생산2팀', '생산3팀', '생산4팀')),
  planned_quantity integer not null check (planned_quantity > 0),
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (assembly_group_id, planned_date, team)
);

comment on table public.post_process_production_plans is '후공정 생산계획 — 조립 그룹·일자·팀별 계획 수량';
comment on column public.post_process_production_plans.order_id is '주문서 FK (orders.id)';
comment on column public.post_process_production_plans.assembly_group_id is '주문 조립 그룹 FK (order_assembly_groups.id)';
comment on column public.post_process_production_plans.planned_date is '계획일 (KST)';
comment on column public.post_process_production_plans.planned_end_date is '후공정 종료일 (없으면 시작일과 동일)';
comment on column public.post_process_production_plans.plan_status is 'draft=가계획, confirmed=확정';
comment on column public.post_process_production_plans.team is '생산팀 (생산2팀, 생산3팀, 생산4팀)';
comment on column public.post_process_production_plans.planned_quantity is '해당 일·팀 계획 수량';
comment on column public.post_process_production_plans.created_by is '등록자 auth.users.id';
comment on column public.post_process_production_plans.created_by_name is '등록자 표시명 스냅샷';

create index if not exists post_process_production_plans_planned_date_idx
  on public.post_process_production_plans (planned_date);

create index if not exists post_process_production_plans_order_id_idx
  on public.post_process_production_plans (order_id);

create index if not exists post_process_production_plans_assembly_group_id_idx
  on public.post_process_production_plans (assembly_group_id);

create index if not exists post_process_production_plans_team_idx
  on public.post_process_production_plans (team);

create index if not exists post_process_production_plans_created_by_idx
  on public.post_process_production_plans (created_by);

-- 기존 DB 보강
alter table public.post_process_production_plans
  add column if not exists planned_end_date date;
alter table public.post_process_production_plans
  add column if not exists plan_status text not null default 'confirmed';
alter table public.post_process_production_plans
  add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.post_process_production_plans
  add column if not exists created_by_name text not null default '';
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'post_process_production_plans_plan_status_check'
  ) then
    alter table public.post_process_production_plans
      add constraint post_process_production_plans_plan_status_check
      check (plan_status in ('draft', 'confirmed'));
  end if;
end $$;

alter table public.post_process_production_plans enable row level security;

drop policy if exists "post_process_production_plans public read" on public.post_process_production_plans;
create policy "post_process_production_plans public read"
  on public.post_process_production_plans for select using (true);

drop policy if exists "post_process_production_plans public insert" on public.post_process_production_plans;
create policy "post_process_production_plans public insert"
  on public.post_process_production_plans for insert with check (true);

drop policy if exists "post_process_production_plans public update" on public.post_process_production_plans;
create policy "post_process_production_plans public update"
  on public.post_process_production_plans for update using (true) with check (true);

drop policy if exists "post_process_production_plans public delete" on public.post_process_production_plans;
create policy "post_process_production_plans public delete"
  on public.post_process_production_plans for delete using (true);
