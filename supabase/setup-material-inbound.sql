-- Supabase SQL Editor에서 실행하세요 (setup-material-purchase-orders.sql 이후)
--
-- 입고번호 = id — MRI-YYMMDD 또는 MRI-YYMMDD01 … 자동 발급

create table if not exists public.material_inbound_records (
  id text primary key,
  inbound_date date not null default (timezone('Asia/Seoul', now()))::date,
  inbound_type text not null default 'supplied'
    check (inbound_type in ('opening', 'purchase', 'supplied', 'return')),
  purchase_order_id text references public.material_purchase_orders(id) on delete restrict,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_inbound_records_id_not_blank_check check (length(trim(id)) > 0),
  constraint material_inbound_records_id_format_check check (id ~ '^MRI-[0-9]{6}([0-9]{2})?$'),
  constraint material_inbound_records_purchase_order_check check (
    (inbound_type = 'purchase' and purchase_order_id is not null)
    or (inbound_type <> 'purchase' and purchase_order_id is null)
  )
);

comment on table public.material_inbound_records is '자재 입고 전표 — MRI-260707';
comment on column public.material_inbound_records.id is '입고번호 MRI-YYMMDD (INSERT 시 자동 발급, 수정 불가)';
comment on column public.material_inbound_records.inbound_type is 'opening=기초, purchase=발주, supplied=사급, return=반품';
comment on column public.material_inbound_records.purchase_order_id is '발주연동 입고 시 발주 FK';

create table if not exists public.material_inbound_lines (
  id uuid primary key default gen_random_uuid(),
  inbound_id text not null references public.material_inbound_records(id) on delete cascade,
  line_seq integer not null default 0,
  material_id text not null references public.materials(id) on delete restrict,
  purchase_order_line_id uuid references public.material_purchase_order_lines(id) on delete restrict,
  quantity numeric not null check (quantity > 0),
  unique (inbound_id, line_seq)
);

comment on table public.material_inbound_lines is '자재 입고 라인';
comment on column public.material_inbound_lines.purchase_order_line_id is '발주연동 입고 시 발주 라인 FK';

create index if not exists material_inbound_records_inbound_date_idx
  on public.material_inbound_records (inbound_date desc);
create index if not exists material_inbound_records_created_at_idx
  on public.material_inbound_records (created_at desc);
create index if not exists material_inbound_records_purchase_order_id_idx
  on public.material_inbound_records (purchase_order_id);
create index if not exists material_inbound_lines_inbound_id_idx
  on public.material_inbound_lines (inbound_id);
create index if not exists material_inbound_lines_material_id_idx
  on public.material_inbound_lines (material_id);
create index if not exists material_inbound_lines_purchase_order_line_id_idx
  on public.material_inbound_lines (purchase_order_line_id);

alter table public.material_inbound_records enable row level security;
alter table public.material_inbound_lines enable row level security;

drop policy if exists "material_inbound_records public read" on public.material_inbound_records;
create policy "material_inbound_records public read"
  on public.material_inbound_records for select using (true);

drop policy if exists "material_inbound_records public insert" on public.material_inbound_records;
create policy "material_inbound_records public insert"
  on public.material_inbound_records for insert with check (true);

drop policy if exists "material_inbound_records public update" on public.material_inbound_records;
create policy "material_inbound_records public update"
  on public.material_inbound_records for update using (true) with check (true);

drop policy if exists "material_inbound_records public delete" on public.material_inbound_records;
create policy "material_inbound_records public delete"
  on public.material_inbound_records for delete using (true);

drop policy if exists "material_inbound_lines public read" on public.material_inbound_lines;
create policy "material_inbound_lines public read"
  on public.material_inbound_lines for select using (true);

drop policy if exists "material_inbound_lines public insert" on public.material_inbound_lines;
create policy "material_inbound_lines public insert"
  on public.material_inbound_lines for insert with check (true);

drop policy if exists "material_inbound_lines public update" on public.material_inbound_lines;
create policy "material_inbound_lines public update"
  on public.material_inbound_lines for update using (true) with check (true);

drop policy if exists "material_inbound_lines public delete" on public.material_inbound_lines;
create policy "material_inbound_lines public delete"
  on public.material_inbound_lines for delete using (true);

create or replace function public.touch_material_inbound_records_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_material_inbound_code()
returns text
language plpgsql
as $$
declare
  seoul_date date;
  year_short text;
  month2 text;
  day2 text;
  prefix text;
  has_base boolean := false;
  max_suffix integer := 0;
  row_id text;
  suffix_text text;
  suffix_num integer;
begin
  seoul_date := (timezone('Asia/Seoul', now()))::date;
  year_short := to_char(seoul_date, 'YY');
  month2 := to_char(seoul_date, 'MM');
  day2 := to_char(seoul_date, 'DD');
  prefix := 'MRI-' || year_short || month2 || day2;

  for row_id in
    select id
    from public.material_inbound_records
    where inbound_date = seoul_date
  loop
    if row_id = prefix then
      has_base := true;
    elsif row_id ~ ('^' || prefix || '[0-9]{2}$') then
      suffix_text := substring(row_id from length(prefix) + 1 for 2);
      suffix_num := suffix_text::integer;
      if suffix_num > max_suffix then
        max_suffix := suffix_num;
      end if;
    end if;
  end loop;

  if not has_base and max_suffix = 0 then
    return prefix;
  end if;

  return prefix || lpad((max_suffix + 1)::text, 2, '0');
end;
$$;

grant execute on function public.generate_material_inbound_code() to anon, authenticated;

create or replace function public.normalize_material_inbound_records_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_material_inbound_code();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.note := coalesce(trim(new.note), '');
  return new;
end;
$$;

drop trigger if exists material_inbound_records_normalize_row on public.material_inbound_records;
create trigger material_inbound_records_normalize_row
  before insert or update on public.material_inbound_records
  for each row
  execute function public.normalize_material_inbound_records_row();

drop trigger if exists material_inbound_records_updated_at on public.material_inbound_records;
create trigger material_inbound_records_updated_at
  before update on public.material_inbound_records
  for each row
  execute function public.touch_material_inbound_records_updated_at();
