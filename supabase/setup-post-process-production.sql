-- Supabase SQL Editor에서 실행하세요 (setup-bom.sql 이후)
--
-- 후공정 생산입력: 조립 그룹(완제품 세트)별 생산 실적 기록

create table if not exists public.post_process_production_records (
  id uuid primary key default gen_random_uuid(),
  record_date date not null default (timezone('Asia/Seoul', now()))::date,
  assembly_group_id uuid not null references public.order_assembly_groups(id) on delete cascade,
  quantity integer not null check (quantity >= 0),
  defect_quantity integer not null default 0 check (defect_quantity >= 0),
  source text not null default 'manual' check (source in ('manual')),
  team text not null default '',
  note text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  check (quantity > 0 or defect_quantity > 0)
);

comment on table public.post_process_production_records is '후공정 생산 실적 — 조립 그룹(완제품)별 등록 이력';
comment on column public.post_process_production_records.record_date is '기록일자 (KST)';
comment on column public.post_process_production_records.assembly_group_id is '주문 조립 그룹 FK (order_assembly_groups.id)';
comment on column public.post_process_production_records.quantity is '이번 등록 양품(완제품 세트) 수량 (불량 전용 등록 시 0)';
comment on column public.post_process_production_records.defect_quantity is '이번 등록 불량 수량 (진행률·잔량 계산에 미포함)';
comment on column public.post_process_production_records.source is 'manual=생산입력 화면';
comment on column public.post_process_production_records.team is '생산팀 (생산2팀, 생산3팀, 생산4팀)';
comment on column public.post_process_production_records.created_by is '등록자 auth.users.id';
comment on column public.post_process_production_records.created_by_name is '등록자 표시명 스냅샷';

create index if not exists post_process_production_records_assembly_group_id_idx
  on public.post_process_production_records (assembly_group_id);

create index if not exists post_process_production_records_created_by_idx
  on public.post_process_production_records (created_by);

create index if not exists post_process_production_records_record_date_idx
  on public.post_process_production_records (record_date desc);

create index if not exists post_process_production_records_created_at_idx
  on public.post_process_production_records (created_at desc);

drop view if exists public.post_process_production_totals;

create view public.post_process_production_totals as
select
  assembly_group_id,
  coalesce(sum(quantity), 0)::integer as total_quantity
from public.post_process_production_records
group by assembly_group_id;

comment on view public.post_process_production_totals is '후공정 조립 그룹별 누적 양품 수량 (defect_quantity 미포함)';

alter table public.post_process_production_records enable row level security;

drop policy if exists "post_process_production_records public read" on public.post_process_production_records;
create policy "post_process_production_records public read"
  on public.post_process_production_records for select using (true);

drop policy if exists "post_process_production_records public insert" on public.post_process_production_records;
create policy "post_process_production_records public insert"
  on public.post_process_production_records for insert with check (true);

drop policy if exists "post_process_production_records public update" on public.post_process_production_records;
create policy "post_process_production_records public update"
  on public.post_process_production_records for update using (true) with check (true);

drop policy if exists "post_process_production_records public delete" on public.post_process_production_records;
create policy "post_process_production_records public delete"
  on public.post_process_production_records for delete using (true);

grant select on public.post_process_production_totals to anon, authenticated;
