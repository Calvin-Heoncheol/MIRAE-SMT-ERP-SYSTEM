-- Supabase SQL Editor에서 실행하세요
--
-- 생산 불량 등록(실적)에 대한 품질 대처(재작업·폐기·특채·보류)

create table if not exists public.quality_defect_handlings (
  id uuid primary key default gen_random_uuid(),
  source_module text not null check (source_module in ('smt', 'post_process')),
  production_record_id uuid not null,
  status text not null default 'pending'
    check (status in ('pending', 'hold', 'completed')),
  action_type text
    check (
      action_type is null
      or action_type in ('rework', 'scrap', 'concession_paid', 'concession_free', 'hold')
    ),
  action_note text not null default '',
  handled_by uuid references auth.users (id) on delete set null,
  handled_by_name text not null default '',
  handled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_module, production_record_id)
);

comment on table public.quality_defect_handlings is '품질 불량대처 — 생산실적(불량) 1건당 대처 상태·조치';
comment on column public.quality_defect_handlings.source_module is 'smt | post_process';
comment on column public.quality_defect_handlings.production_record_id is 'smt_production_records.id 또는 post_process_production_records.id';
comment on column public.quality_defect_handlings.status is 'pending=미대처, hold=보류, completed=대처완료';
comment on column public.quality_defect_handlings.action_type is 'rework|scrap|concession_paid|concession_free|hold';

create index if not exists quality_defect_handlings_status_idx
  on public.quality_defect_handlings (status);

create index if not exists quality_defect_handlings_handled_at_idx
  on public.quality_defect_handlings (handled_at desc nulls last);

alter table public.quality_defect_handlings enable row level security;

drop policy if exists "quality_defect_handlings public read" on public.quality_defect_handlings;
create policy "quality_defect_handlings public read"
  on public.quality_defect_handlings for select using (true);

drop policy if exists "quality_defect_handlings public insert" on public.quality_defect_handlings;
create policy "quality_defect_handlings public insert"
  on public.quality_defect_handlings for insert with check (true);

drop policy if exists "quality_defect_handlings public update" on public.quality_defect_handlings;
create policy "quality_defect_handlings public update"
  on public.quality_defect_handlings for update using (true) with check (true);

drop policy if exists "quality_defect_handlings public delete" on public.quality_defect_handlings;
create policy "quality_defect_handlings public delete"
  on public.quality_defect_handlings for delete using (true);
