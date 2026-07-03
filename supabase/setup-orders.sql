-- Supabase SQL Editor에서 실행하세요 (setup-quotations.sql 이후)

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  order_date date not null default current_date,
  delivery_date date,
  customer text not null default '',
  category text not null default '양산' check (category in ('양산', '샘플', '자재')),
  source text not null default 'manual',
  source_quote_number text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  line_seq integer not null default 0,
  product_code text not null default '',
  product_name text not null default '',
  quantity integer not null default 0 check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  order_amount numeric not null default 0 check (order_amount >= 0),
  unique (order_id, line_seq)
);

create index if not exists orders_order_date_idx on public.orders (order_date desc);
create index if not exists orders_order_number_idx on public.orders (order_number desc);
create index if not exists orders_customer_idx on public.orders (customer);
create index if not exists order_lines_order_id_idx on public.order_lines (order_id);

alter table public.orders enable row level security;
alter table public.order_lines enable row level security;

drop policy if exists "orders public read" on public.orders;
create policy "orders public read" on public.orders for select using (true);

drop policy if exists "orders public insert" on public.orders;
create policy "orders public insert" on public.orders for insert with check (true);

drop policy if exists "orders public update" on public.orders;
create policy "orders public update" on public.orders for update using (true) with check (true);

drop policy if exists "orders public delete" on public.orders;
create policy "orders public delete" on public.orders for delete using (true);

drop policy if exists "order_lines public read" on public.order_lines;
create policy "order_lines public read" on public.order_lines for select using (true);

drop policy if exists "order_lines public insert" on public.order_lines;
create policy "order_lines public insert" on public.order_lines for insert with check (true);

drop policy if exists "order_lines public update" on public.order_lines;
create policy "order_lines public update" on public.order_lines for update using (true) with check (true);

drop policy if exists "order_lines public delete" on public.order_lines;
create policy "order_lines public delete" on public.order_lines for delete using (true);

-- 주문서번호: MRO + YYMM + 3자리 순번 (예: MRO2604001)
create or replace function public.generate_order_number()
returns text
language plpgsql
as $$
declare
  prefix text;
  yymm text;
  max_num integer;
  next_num integer;
begin
  yymm := to_char(current_date, 'YYMM');
  prefix := 'MRO' || yymm;

  select coalesce(max(
    nullif(regexp_replace(order_number, '^' || prefix, ''), '')::integer
  ), 0)
  into max_num
  from public.orders
  where order_number like prefix || '%';

  next_num := max_num + 1;
  return prefix || lpad(next_num::text, 3, '0');
end;
$$;

grant execute on function public.generate_order_number() to anon, authenticated;
