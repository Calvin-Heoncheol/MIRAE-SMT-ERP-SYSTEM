-- Supabase SQL Editor에서 실행하세요
--
-- 메탈마스크 개체(바코드) + 사용 이력 — SMT 메탈마스크 탭에서 별도 입력

create table if not exists public.metal_mask_assets (
  id uuid primary key default gen_random_uuid(),
  barcode text not null,
  name text not null default '',
  pcb_side text not null default 'SINGLE' check (pcb_side in ('SINGLE', 'TOP', 'BOT')),
  use_limit integer not null default 50000 check (use_limit > 0),
  use_count integer not null default 0 check (use_count >= 0),
  status text not null default 'active' check (status in ('active', 'retired')),
  note text not null default '',
  item_id text references public.items(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint metal_mask_assets_barcode_unique unique (barcode)
);

comment on table public.metal_mask_assets is '메탈마스크 개체 — 바코드별 사용횟수 추적';
comment on column public.metal_mask_assets.barcode is '마스크 바코드 (고유)';
comment on column public.metal_mask_assets.item_id is '기초등록 반제품 items.id';
comment on column public.metal_mask_assets.pcb_side is '사용 면: SINGLE / TOP / BOT';
comment on column public.metal_mask_assets.use_limit is '교체 한도 (기본 50000)';
comment on column public.metal_mask_assets.use_count is '누적 사용 횟수 (shot)';
comment on column public.metal_mask_assets.status is 'active=사용중, retired=교체완료';

create index if not exists metal_mask_assets_status_idx
  on public.metal_mask_assets (status);

create index if not exists metal_mask_assets_pcb_side_idx
  on public.metal_mask_assets (pcb_side);

create index if not exists metal_mask_assets_item_id_idx
  on public.metal_mask_assets (item_id);

create table if not exists public.metal_mask_usage_logs (
  id uuid primary key default gen_random_uuid(),
  asset_id uuid not null references public.metal_mask_assets(id) on delete cascade,
  smt_production_record_id uuid references public.smt_production_records(id) on delete set null,
  pcb_side text not null check (pcb_side in ('SINGLE', 'TOP', 'BOT')),
  delta_qty integer not null check (delta_qty > 0),
  record_date date not null default (timezone('Asia/Seoul', now()))::date,
  created_at timestamptz not null default now()
);

comment on table public.metal_mask_usage_logs is '메탈마스크 사용 이력 — SMT 탭 별도 입력';
comment on column public.metal_mask_usage_logs.delta_qty is '이번에 가산한 사용 횟수';

create index if not exists metal_mask_usage_logs_asset_id_idx
  on public.metal_mask_usage_logs (asset_id);

create index if not exists metal_mask_usage_logs_record_date_idx
  on public.metal_mask_usage_logs (record_date desc);

create index if not exists metal_mask_usage_logs_smt_record_idx
  on public.metal_mask_usage_logs (smt_production_record_id);

alter table public.metal_mask_assets enable row level security;
alter table public.metal_mask_usage_logs enable row level security;

drop policy if exists "metal_mask_assets public read" on public.metal_mask_assets;
create policy "metal_mask_assets public read"
  on public.metal_mask_assets for select using (true);

drop policy if exists "metal_mask_assets public insert" on public.metal_mask_assets;
create policy "metal_mask_assets public insert"
  on public.metal_mask_assets for insert with check (true);

drop policy if exists "metal_mask_assets public update" on public.metal_mask_assets;
create policy "metal_mask_assets public update"
  on public.metal_mask_assets for update using (true) with check (true);

drop policy if exists "metal_mask_assets public delete" on public.metal_mask_assets;
create policy "metal_mask_assets public delete"
  on public.metal_mask_assets for delete using (true);

drop policy if exists "metal_mask_usage_logs public read" on public.metal_mask_usage_logs;
create policy "metal_mask_usage_logs public read"
  on public.metal_mask_usage_logs for select using (true);

drop policy if exists "metal_mask_usage_logs public insert" on public.metal_mask_usage_logs;
create policy "metal_mask_usage_logs public insert"
  on public.metal_mask_usage_logs for insert with check (true);

drop policy if exists "metal_mask_usage_logs public update" on public.metal_mask_usage_logs;
create policy "metal_mask_usage_logs public update"
  on public.metal_mask_usage_logs for update using (true) with check (true);

drop policy if exists "metal_mask_usage_logs public delete" on public.metal_mask_usage_logs;
create policy "metal_mask_usage_logs public delete"
  on public.metal_mask_usage_logs for delete using (true);
