-- Supabase SQL Editor에서 실행하세요
-- (setup-orders.sql, setup-post-process-production.sql 이후)
--
-- 생산 단위 라벨 바코드 — ERP 출력 시 발급, 다른 PC에서도 스캔·등록 가능

create table if not exists public.production_unit_labels (
  id uuid primary key default gen_random_uuid(),
  barcode text not null,
  assembly_group_id uuid not null references public.order_assembly_groups (id) on delete cascade,
  team text not null default '' check (team in ('', '생산2팀', '생산3팀', '생산4팀')),
  plan_id uuid references public.post_process_production_plans (id) on delete set null,
  job_base_code text not null default '',
  scanned_at timestamptz,
  scanned_by uuid references auth.users (id) on delete set null,
  scanned_by_name text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  constraint production_unit_labels_barcode_key unique (barcode)
);

comment on table public.production_unit_labels is '생산 단위 라벨 바코드 — 출력 발급·스캔 완료 (PC 공용)';
comment on column public.production_unit_labels.barcode is '정규화된 바코드 (대문자)';
comment on column public.production_unit_labels.assembly_group_id is '주문 조립 그룹 FK';
comment on column public.production_unit_labels.team is '생산팀 (생산2팀, 생산3팀, 생산4팀)';
comment on column public.production_unit_labels.plan_id is '후공정 계획 FK (선택)';
comment on column public.production_unit_labels.job_base_code is '건 식별 코드 (예: MRP2|…|생산4팀)';
comment on column public.production_unit_labels.scanned_at is '스캔·양품 등록 시각 (null=미사용)';

create index if not exists production_unit_labels_assembly_group_id_idx
  on public.production_unit_labels (assembly_group_id);

create index if not exists production_unit_labels_team_idx
  on public.production_unit_labels (team)
  where team <> '';

create index if not exists production_unit_labels_assembly_created_idx
  on public.production_unit_labels (assembly_group_id, created_at desc);

create index if not exists production_unit_labels_unscanned_idx
  on public.production_unit_labels (barcode)
  where scanned_at is null;

alter table public.production_unit_labels enable row level security;

drop policy if exists "production_unit_labels public read" on public.production_unit_labels;
create policy "production_unit_labels public read"
  on public.production_unit_labels for select using (true);

drop policy if exists "production_unit_labels public insert" on public.production_unit_labels;
create policy "production_unit_labels public insert"
  on public.production_unit_labels for insert with check (true);

drop policy if exists "production_unit_labels public update" on public.production_unit_labels;
create policy "production_unit_labels public update"
  on public.production_unit_labels for update using (true) with check (true);

drop policy if exists "production_unit_labels public delete" on public.production_unit_labels;
create policy "production_unit_labels public delete"
  on public.production_unit_labels for delete using (true);

-- AUTH_ENABLED 환경이면 migrate-rls-authenticated-writes.sql 에 아래를 추가해 재실행하세요:
--   select public._erp_reset_table_rls('production_unit_labels', 'ops');
