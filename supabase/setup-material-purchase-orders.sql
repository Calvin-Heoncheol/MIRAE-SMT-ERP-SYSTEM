-- Supabase SQL Editor에서 실행하세요 (setup-items.sql 이후)
--
-- 발주번호 = id — MRP-YYMMDD 또는 MRP-YYMMDD01 … 자동 발급

create table if not exists public.material_purchase_orders (
  id text primary key,
  order_date date not null default (timezone('Asia/Seoul', now()))::date,
  delivery_date date,
  supplier text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint material_purchase_orders_id_not_blank_check check (length(trim(id)) > 0),
  constraint material_purchase_orders_id_format_check check (id ~ '^MRP-[0-9]{6}([0-9]{2})?$')
);

comment on table public.material_purchase_orders is '자재 발주 마스터 — 발주번호=id(MRP-260707)';
comment on column public.material_purchase_orders.id is '발주번호 MRP-YYMMDD (INSERT 시 자동 발급, 수정 불가)';
comment on column public.material_purchase_orders.supplier is '공급업체';

create table if not exists public.material_purchase_order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.material_purchase_orders(id) on delete cascade,
  line_seq integer not null default 0,
  material_id text references public.items(id) on delete set null,
  cpn text not null default '',
  material_name text not null default '',
  specification text not null default '',
  mpn text not null default '',
  quantity numeric not null default 0 check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  order_amount numeric not null default 0 check (order_amount >= 0),
  status text not null default '발주',
  inbound_quantity numeric not null default 0 check (inbound_quantity >= 0),
  unique (order_id, line_seq)
);

comment on column public.material_purchase_order_lines.status is '발주 / (입고 후 변경)';
comment on column public.material_purchase_order_lines.inbound_quantity is '누적 입고 수량 (입고 모듈 연동용)';

create index if not exists material_purchase_orders_order_date_idx
  on public.material_purchase_orders (order_date desc);
create index if not exists material_purchase_orders_created_at_idx
  on public.material_purchase_orders (created_at desc);
create index if not exists material_purchase_orders_supplier_idx
  on public.material_purchase_orders (supplier);
create index if not exists material_purchase_order_lines_order_id_idx
  on public.material_purchase_order_lines (order_id);

alter table public.material_purchase_orders enable row level security;
alter table public.material_purchase_order_lines enable row level security;

drop policy if exists "material_purchase_orders public read" on public.material_purchase_orders;
create policy "material_purchase_orders public read"
  on public.material_purchase_orders for select using (true);

drop policy if exists "material_purchase_orders public insert" on public.material_purchase_orders;
create policy "material_purchase_orders public insert"
  on public.material_purchase_orders for insert with check (true);

drop policy if exists "material_purchase_orders public update" on public.material_purchase_orders;
create policy "material_purchase_orders public update"
  on public.material_purchase_orders for update using (true) with check (true);

drop policy if exists "material_purchase_orders public delete" on public.material_purchase_orders;
create policy "material_purchase_orders public delete"
  on public.material_purchase_orders for delete using (true);

drop policy if exists "material_purchase_order_lines public read" on public.material_purchase_order_lines;
create policy "material_purchase_order_lines public read"
  on public.material_purchase_order_lines for select using (true);

drop policy if exists "material_purchase_order_lines public insert" on public.material_purchase_order_lines;
create policy "material_purchase_order_lines public insert"
  on public.material_purchase_order_lines for insert with check (true);

drop policy if exists "material_purchase_order_lines public update" on public.material_purchase_order_lines;
create policy "material_purchase_order_lines public update"
  on public.material_purchase_order_lines for update using (true) with check (true);

drop policy if exists "material_purchase_order_lines public delete" on public.material_purchase_order_lines;
create policy "material_purchase_order_lines public delete"
  on public.material_purchase_order_lines for delete using (true);

create or replace function public.touch_material_purchase_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_material_purchase_order_code()
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
  prefix := 'MRP-' || year_short || month2 || day2;

  for row_id in
    select id
    from public.material_purchase_orders
    where order_date = seoul_date
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

grant execute on function public.generate_material_purchase_order_code() to anon, authenticated;

create or replace function public.normalize_material_purchase_orders_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_material_purchase_order_code();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.supplier := coalesce(trim(new.supplier), '');
  return new;
end;
$$;

drop trigger if exists material_purchase_orders_normalize_row on public.material_purchase_orders;
create trigger material_purchase_orders_normalize_row
  before insert or update on public.material_purchase_orders
  for each row
  execute function public.normalize_material_purchase_orders_row();

drop trigger if exists material_purchase_orders_updated_at on public.material_purchase_orders;
create trigger material_purchase_orders_updated_at
  before update on public.material_purchase_orders
  for each row
  execute function public.touch_material_purchase_orders_updated_at();

-- 자재 발주 「주문서」카드만 삭제 (고객 주문은 유지)
create table if not exists public.material_purchase_need_deleted_orders (
  order_id text primary key references public.orders(id) on delete cascade,
  deleted_at timestamptz not null default now()
);

comment on table public.material_purchase_need_deleted_orders is
  '자재 발주 화면 주문서 카드 삭제 목록 — 고객 주문(orders)은 삭제하지 않음';

create index if not exists material_purchase_need_deleted_orders_deleted_at_idx
  on public.material_purchase_need_deleted_orders (deleted_at desc);

alter table public.material_purchase_need_deleted_orders enable row level security;

drop policy if exists "material_purchase_need_deleted_orders public read"
  on public.material_purchase_need_deleted_orders;
create policy "material_purchase_need_deleted_orders public read"
  on public.material_purchase_need_deleted_orders for select using (true);

drop policy if exists "material_purchase_need_deleted_orders public insert"
  on public.material_purchase_need_deleted_orders;
create policy "material_purchase_need_deleted_orders public insert"
  on public.material_purchase_need_deleted_orders for insert with check (true);

drop policy if exists "material_purchase_need_deleted_orders public delete"
  on public.material_purchase_need_deleted_orders;
create policy "material_purchase_need_deleted_orders public delete"
  on public.material_purchase_need_deleted_orders for delete using (true);
