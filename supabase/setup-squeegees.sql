-- Supabase SQL Editor에서 실행하세요
--
-- 스퀴즈 개체(바코드) + 사용 이력 — SMT 탭에서 별도 입력 (면 구분 없음)

create table if not exists public.squeegee_assets (
  id uuid primary key default gen_random_uuid(),
  barcode text not null,
  name text not null default '',
  use_limit integer not null default 50000 check (use_limit > 0),
  use_count integer not null default 0 check (use_count >= 0),
  status text not null default 'active' check (status in ('active', 'retired')),
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint squeegee_assets_barcode_unique unique (barcode)
);

comment on table public.squeegee_assets is '스퀴즈 개체 — 바코드별 사용횟수 추적 (TOP/BOT 없음)';
comment on column public.squeegee_assets.barcode is '스퀴즈 바코드 (고유)';
comment on column public.squeegee_assets.use_limit is '교체 한도 (기본 50000)';
comment on column public.squeegee_assets.use_count is '누적 사용 횟수';
comment on column public.squeegee_assets.status is 'active=사용중, retired=교체완료';

create index if not exists squeegee_assets_status_idx
  on public.squeegee_assets (status);

create table if not exists public.squeegee_usage_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.squeegee_assets(id) on delete cascade,
  delta_qty integer not null check (delta_qty > 0),
  record_date date not null default (timezone('Asia/Seoul', now()))::date,
  smt_production_record_id uuid references public.smt_production_records(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.squeegee_usage_logs is '스퀴즈 사용 이력 — SMT 탭 별도 입력';
comment on column public.squeegee_usage_logs.delta_qty is '이번에 가산한 사용 횟수';
comment on column public.squeegee_usage_logs.smt_production_record_id is '연동된 SMT 생산 실적';

create index if not exists squeegee_usage_logs_asset_id_idx
  on public.squeegee_usage_logs (asset_id);

create index if not exists squeegee_usage_logs_record_date_idx
  on public.squeegee_usage_logs (record_date desc);

create index if not exists squeegee_usage_logs_smt_record_idx
  on public.squeegee_usage_logs (smt_production_record_id);

alter table public.squeegee_assets enable row level security;
alter table public.squeegee_usage_logs enable row level security;

drop policy if exists "squeegee_assets public read" on public.squeegee_assets;
create policy "squeegee_assets public read"
  on public.squeegee_assets for select using (true);

drop policy if exists "squeegee_assets public insert" on public.squeegee_assets;
create policy "squeegee_assets public insert"
  on public.squeegee_assets for insert with check (true);

drop policy if exists "squeegee_assets public update" on public.squeegee_assets;
create policy "squeegee_assets public update"
  on public.squeegee_assets for update using (true) with check (true);

drop policy if exists "squeegee_assets public delete" on public.squeegee_assets;
create policy "squeegee_assets public delete"
  on public.squeegee_assets for delete using (true);

drop policy if exists "squeegee_usage_logs public read" on public.squeegee_usage_logs;
create policy "squeegee_usage_logs public read"
  on public.squeegee_usage_logs for select using (true);

drop policy if exists "squeegee_usage_logs public insert" on public.squeegee_usage_logs;
create policy "squeegee_usage_logs public insert"
  on public.squeegee_usage_logs for insert with check (true);

drop policy if exists "squeegee_usage_logs public update" on public.squeegee_usage_logs;
create policy "squeegee_usage_logs public update"
  on public.squeegee_usage_logs for update using (true) with check (true);

drop policy if exists "squeegee_usage_logs public delete" on public.squeegee_usage_logs;
create policy "squeegee_usage_logs public delete"
  on public.squeegee_usage_logs for delete using (true);
