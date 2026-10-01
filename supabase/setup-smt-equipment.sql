-- Supabase SQL Editor에서 실행하세요
--
-- 설비등록 — SMD 라인 + 라인별 설비(호기) · CPH

create table if not exists public.smt_lines (
  id uuid primary key default gen_random_uuid(),
  line_no integer not null check (line_no >= 1),
  name text not null default '',
  is_active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smt_lines_line_no_unique unique (line_no)
);

comment on table public.smt_lines is 'SMD 라인 — line_no 는 생산계획·생산등록의 라인 번호와 동일';
comment on column public.smt_lines.line_no is '라인 번호 (smt_production_plans.line_no / smt_production_records.line_no)';

create table if not exists public.smt_equipment (
  id uuid primary key default gen_random_uuid(),
  line_id uuid not null references public.smt_lines(id) on delete cascade,
  equipment_type text not null default 'mounter'
    check (equipment_type in ('mounter', 'printer', 'spi', 'reflow', 'aoi', 'other')),
  unit_no integer not null check (unit_no >= 1),
  maker text not null default '',
  model text not null default '',
  serial_no text not null default '',
  rated_cph integer check (rated_cph is null or rated_cph > 0),
  effective_cph integer check (effective_cph is null or effective_cph > 0),
  installed_at date,
  is_active boolean not null default true,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint smt_equipment_line_type_unit_unique unique (line_id, equipment_type, unit_no)
);

comment on table public.smt_equipment is '라인별 설비 (호기)';
comment on column public.smt_equipment.equipment_type is 'mounter=마운터, printer=인쇄기, spi=SPI, reflow=리플로우, aoi=AOI, other=기타';
comment on column public.smt_equipment.unit_no is '호기 번호 — 라인·설비종류 안에서 고유';
comment on column public.smt_equipment.rated_cph is '사양(카탈로그) CPH — 마운터만';
comment on column public.smt_equipment.effective_cph is '실제(현장 기준) CPH — 마운터만';

create index if not exists smt_equipment_line_id_idx
  on public.smt_equipment (line_id);

alter table public.smt_lines enable row level security;
alter table public.smt_equipment enable row level security;

drop policy if exists "smt_lines public read" on public.smt_lines;
create policy "smt_lines public read"
  on public.smt_lines for select using (true);

drop policy if exists "smt_lines public insert" on public.smt_lines;
create policy "smt_lines public insert"
  on public.smt_lines for insert with check (true);

drop policy if exists "smt_lines public update" on public.smt_lines;
create policy "smt_lines public update"
  on public.smt_lines for update using (true) with check (true);

drop policy if exists "smt_lines public delete" on public.smt_lines;
create policy "smt_lines public delete"
  on public.smt_lines for delete using (true);

drop policy if exists "smt_equipment public read" on public.smt_equipment;
create policy "smt_equipment public read"
  on public.smt_equipment for select using (true);

drop policy if exists "smt_equipment public insert" on public.smt_equipment;
create policy "smt_equipment public insert"
  on public.smt_equipment for insert with check (true);

drop policy if exists "smt_equipment public update" on public.smt_equipment;
create policy "smt_equipment public update"
  on public.smt_equipment for update using (true) with check (true);

drop policy if exists "smt_equipment public delete" on public.smt_equipment;
create policy "smt_equipment public delete"
  on public.smt_equipment for delete using (true);
