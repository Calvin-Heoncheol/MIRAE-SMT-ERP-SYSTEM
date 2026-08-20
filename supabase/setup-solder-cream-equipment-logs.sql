-- Supabase SQL Editor에서 실행하세요
--
-- 솔더크림 설비(냉장고·교반) CSV 로그 임포트

create table if not exists public.solder_cream_log_imports (
  id uuid primary key default gen_random_uuid(),
  source_name text not null default '',
  source_hash text not null default '',
  row_count integer not null default 0 check (row_count >= 0),
  imported_at timestamptz not null default now(),
  note text not null default ''
);

comment on table public.solder_cream_log_imports is '솔더크림 설비 로그 CSV 임포트 배치';
comment on column public.solder_cream_log_imports.source_name is '원본 파일명';
comment on column public.solder_cream_log_imports.source_hash is '파일 내용 SHA-256 (중복 임포트 방지)';

create unique index if not exists solder_cream_log_imports_source_hash_uidx
  on public.solder_cream_log_imports (source_hash)
  where length(trim(source_hash)) > 0;

create table if not exists public.solder_cream_equipment_logs (
  id uuid primary key default gen_random_uuid(),
  import_id uuid not null references public.solder_cream_log_imports(id) on delete cascade,
  source_row integer not null default 0 check (source_row >= 0),
  recorded_at timestamptz not null,
  equipment_type text not null default 'unknown'
    check (equipment_type in ('fridge', 'mixer', 'unknown')),
  equipment_id text not null default '',
  lot_number text not null default '',
  event_type text not null default 'unknown'
    check (event_type in ('store', 'open', 'mix_start', 'mix_complete', 'alarm', 'discard', 'unknown')),
  temperature numeric,
  mix_seconds integer check (mix_seconds is null or mix_seconds >= 0),
  result text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (import_id, source_row)
);

comment on table public.solder_cream_equipment_logs is '솔더크림 설비 로그 — CSV 정규화 행';
comment on column public.solder_cream_equipment_logs.lot_number is '내부 LOT(MRL-…) 또는 설비 LOT';
comment on column public.solder_cream_equipment_logs.event_type is 'store=냉장, open=개봉, mix_start/mix_complete=교반, alarm=알람';

create index if not exists solder_cream_equipment_logs_recorded_at_idx
  on public.solder_cream_equipment_logs (recorded_at desc);

create index if not exists solder_cream_equipment_logs_lot_number_idx
  on public.solder_cream_equipment_logs (lot_number);

create index if not exists solder_cream_equipment_logs_import_id_idx
  on public.solder_cream_equipment_logs (import_id);

alter table public.solder_cream_log_imports enable row level security;
alter table public.solder_cream_equipment_logs enable row level security;

drop policy if exists "solder_cream_log_imports public read" on public.solder_cream_log_imports;
create policy "solder_cream_log_imports public read"
  on public.solder_cream_log_imports for select using (true);

drop policy if exists "solder_cream_log_imports public insert" on public.solder_cream_log_imports;
create policy "solder_cream_log_imports public insert"
  on public.solder_cream_log_imports for insert with check (true);

drop policy if exists "solder_cream_log_imports public delete" on public.solder_cream_log_imports;
create policy "solder_cream_log_imports public delete"
  on public.solder_cream_log_imports for delete using (true);

drop policy if exists "solder_cream_equipment_logs public read" on public.solder_cream_equipment_logs;
create policy "solder_cream_equipment_logs public read"
  on public.solder_cream_equipment_logs for select using (true);

drop policy if exists "solder_cream_equipment_logs public insert" on public.solder_cream_equipment_logs;
create policy "solder_cream_equipment_logs public insert"
  on public.solder_cream_equipment_logs for insert with check (true);

drop policy if exists "solder_cream_equipment_logs public delete" on public.solder_cream_equipment_logs;
create policy "solder_cream_equipment_logs public delete"
  on public.solder_cream_equipment_logs for delete using (true);
