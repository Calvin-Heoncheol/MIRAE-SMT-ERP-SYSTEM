-- Supabase SQL Editor에서 실행하세요 (setup-material-inbound.sql · setup-orders.sql · setup-items.sql 이후)
--
-- 불출번호 = id — MROB-0001, MROB-0002 … 자동 발급

create table if not exists public.material_outbound_records (
  id text primary key,
  outbound_date date not null default (timezone('Asia/Seoul', now()))::date,
  outbound_type text not null default 'production'
    check (outbound_type in ('production', 'scrap', 'adjustment')),
  order_id text references public.orders(id) on delete restrict,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_outbound_records_id_not_blank_check check (length(trim(id)) > 0),
  constraint material_outbound_records_id_format_check check (id ~ '^MROB-[0-9]+$'),
  constraint material_outbound_records_order_check check (
    (outbound_type = 'production' and order_id is not null)
    or (outbound_type <> 'production')
  )
);

comment on table public.material_outbound_records is '자재 불출 전표 — MROB-0001';
comment on column public.material_outbound_records.id is '불출번호 MROB-0001 (INSERT 시 자동 발급, 수정 불가)';
comment on column public.material_outbound_records.outbound_type is 'production=생산, scrap=폐기, adjustment=조정';
comment on column public.material_outbound_records.order_id is '생산 불출 시 주문 FK';

create table if not exists public.material_outbound_lines (
  id uuid primary key default gen_random_uuid(),
  outbound_id text not null references public.material_outbound_records(id) on delete cascade,
  line_seq integer not null default 0,
  material_id text not null references public.items(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unique (outbound_id, line_seq)
);

comment on table public.material_outbound_lines is '자재 불출 라인';
comment on column public.material_outbound_lines.material_id is '품목 FK (items.id · 원자재/부자재)';

create index if not exists material_outbound_records_outbound_date_idx
  on public.material_outbound_records (outbound_date desc);
create index if not exists material_outbound_records_created_at_idx
  on public.material_outbound_records (created_at desc);
create index if not exists material_outbound_records_order_id_idx
  on public.material_outbound_records (order_id);
create index if not exists material_outbound_lines_outbound_id_idx
  on public.material_outbound_lines (outbound_id);
create index if not exists material_outbound_lines_material_id_idx
  on public.material_outbound_lines (material_id);

alter table public.material_outbound_records enable row level security;
alter table public.material_outbound_lines enable row level security;

drop policy if exists "material_outbound_records public read" on public.material_outbound_records;
create policy "material_outbound_records public read"
  on public.material_outbound_records for select using (true);

drop policy if exists "material_outbound_records public insert" on public.material_outbound_records;
create policy "material_outbound_records public insert"
  on public.material_outbound_records for insert with check (true);

drop policy if exists "material_outbound_records public update" on public.material_outbound_records;
create policy "material_outbound_records public update"
  on public.material_outbound_records for update using (true) with check (true);

drop policy if exists "material_outbound_records public delete" on public.material_outbound_records;
create policy "material_outbound_records public delete"
  on public.material_outbound_records for delete using (true);

drop policy if exists "material_outbound_lines public read" on public.material_outbound_lines;
create policy "material_outbound_lines public read"
  on public.material_outbound_lines for select using (true);

drop policy if exists "material_outbound_lines public insert" on public.material_outbound_lines;
create policy "material_outbound_lines public insert"
  on public.material_outbound_lines for insert with check (true);

drop policy if exists "material_outbound_lines public update" on public.material_outbound_lines;
create policy "material_outbound_lines public update"
  on public.material_outbound_lines for update using (true) with check (true);

drop policy if exists "material_outbound_lines public delete" on public.material_outbound_lines;
create policy "material_outbound_lines public delete"
  on public.material_outbound_lines for delete using (true);

create or replace function public.touch_material_outbound_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_material_outbound_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MROB-', ''), '')::integer
  ), 0)
  into max_num
  from public.material_outbound_records
  where id ~ '^MROB-[0-9]+$';

  next_num := max_num + 1;
  return 'MROB-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_material_outbound_code() to anon, authenticated;

create or replace function public.normalize_material_outbound_records_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_material_outbound_code();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.note := coalesce(trim(new.note), '');
  return new;
end;
$$;

drop trigger if exists material_outbound_records_normalize_row on public.material_outbound_records;
create trigger material_outbound_records_normalize_row
  before insert or update on public.material_outbound_records
  for each row
  execute function public.normalize_material_outbound_records_row();

drop trigger if exists material_outbound_records_updated_at on public.material_outbound_records;
create trigger material_outbound_records_updated_at
  before update on public.material_outbound_records
  for each row
  execute function public.touch_material_outbound_records_updated_at();
