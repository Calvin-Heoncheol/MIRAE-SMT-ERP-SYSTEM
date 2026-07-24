-- Supabase SQL Editor에서 실행하세요 (setup-quotations.sql 이후)
--
-- 주문코드 = id — 고객사 PO/NO 직접 입력 또는 고객사접두사-0001 자동 발급
-- (예: 서창→SC-0001, 파스텍→PST-0001, 불가 시 MRO-0001)

create table if not exists public.orders (
  id text primary key,
  order_date date not null default current_date,
  delivery_date date,
  customer text not null default '',
  category text not null default '양산' check (category in ('양산', '샘플', '자재')),
  source text not null default 'manual',
  source_quote_id text references public.quotations(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_id_not_blank_check check (length(trim(id)) > 0),
  constraint orders_id_length_check check (char_length(id) <= 100)
);

comment on table public.orders is '주문 마스터 — 주문코드=id(고객사 PO/NO 또는 고객사접두사-0001)';
comment on column public.orders.id is '주문코드 — 고객사 PO/NO 또는 고객사접두사-0001 (INSERT 시 비어 있으면 자동 발급, 수정 불가)';
comment on column public.orders.source_quote_id is '원본 견적 FK (quotations.id = MRQ-0001)';
comment on column public.orders.note is '주문서 비고';

create table if not exists public.order_lines (
  id uuid primary key default gen_random_uuid(),
  order_id text not null references public.orders(id) on delete cascade,
  line_seq integer not null default 0,
  product_code text not null default '',
  product_name text not null default '',
  quantity integer not null default 0 check (quantity > 0),
  unit_price numeric not null default 0 check (unit_price >= 0),
  order_amount numeric not null default 0 check (order_amount >= 0),
  delivery_date date,
  derived_from_line_id uuid references public.order_lines(id) on delete cascade,
  unique (order_id, line_seq)
);

comment on column public.order_lines.derived_from_line_id is '완제품 주문 줄에서 BOM 펼침으로 생성된 반제품 줄 (주문 UI 비표시)';
comment on column public.order_lines.delivery_date is '제품(라인)별 납기일';

create index if not exists orders_order_date_idx on public.orders (order_date desc);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_customer_idx on public.orders (customer);
create index if not exists orders_source_quote_id_idx on public.orders (source_quote_id);
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

create or replace function public.touch_orders_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.order_code_prefix_from_customer(customer text)
returns text
language plpgsql
immutable
as $$
declare
  cho text[] := array[
    'g','kk','n','d','tt','r','m','b','pp','s','ss','',
    'j','jj','ch','k','t','p','h'
  ];
  jung text[] := array[
    'a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo',
    'u','wo','we','wi','yu','eu','ui','i'
  ];
  src text := regexp_replace(coalesce(customer, ''), '\s+', '', 'g');
  ch text;
  code integer;
  s integer;
  cho_i integer;
  jung_i integer;
  initial text;
  vowel text;
  roman text;
  letters text := '';
  prefix text;
begin
  for i in 1..char_length(src) loop
    ch := substr(src, i, 1);

    if ch ~ '[A-Za-z]' then
      letters := letters || upper(ch);
      continue;
    end if;

    if ch ~ '[0-9]' then
      letters := letters || ch;
      continue;
    end if;

    code := ascii(ch);
    if code < 44032 or code > 55203 then
      continue;
    end if;

    s := code - 44032;
    cho_i := s / 588;
    jung_i := (s % 588) / 28;
    initial := cho[cho_i + 1];
    vowel := jung[jung_i + 1];
    roman := nullif(initial, '');
    if roman is null then
      roman := vowel;
    end if;
    if roman is null or roman = '' then
      continue;
    end if;

    letters := letters || upper(substr(roman, 1, 1));
  end loop;

  prefix := letters;
  if char_length(prefix) > 4 then
    prefix := substr(prefix, 1, 3);
  end if;

  if prefix is null or prefix = '' then
    return 'MRO';
  end if;

  return prefix;
end;
$$;

create or replace function public.generate_order_code(customer text default '')
returns text
language plpgsql
as $$
declare
  prefix text;
  max_num integer;
  next_num integer;
  pattern text;
begin
  prefix := public.order_code_prefix_from_customer(customer);
  pattern := '^' || prefix || '-[0-9]+$';

  select coalesce(max(
    nullif(regexp_replace(id, '^' || prefix || '-', ''), '')::integer
  ), 0)
  into max_num
  from public.orders
  where id ~ pattern;

  next_num := max_num + 1;
  return prefix || '-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.order_code_prefix_from_customer(text) to anon, authenticated;
grant execute on function public.generate_order_code(text) to anon, authenticated;

create or replace function public.normalize_orders_row()
returns trigger
language plpgsql
as $$
begin
  new.customer := coalesce(trim(new.customer), '');

  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_order_code(new.customer);
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  return new;
end;
$$;

drop trigger if exists orders_normalize_row on public.orders;
create trigger orders_normalize_row
  before insert or update on public.orders
  for each row
  execute function public.normalize_orders_row();

drop trigger if exists orders_updated_at on public.orders;
create trigger orders_updated_at
  before update on public.orders
  for each row
  execute function public.touch_orders_updated_at();
