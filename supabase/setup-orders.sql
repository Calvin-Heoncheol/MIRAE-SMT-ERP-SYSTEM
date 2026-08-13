-- Supabase SQL Editor에서 실행하세요 (setup-quotations.sql 이후)
--
-- 내부 발주ID = id — MRO-YYMMDD-NN 자동 발급 또는 직접 입력 (FK 기준키, 수정 불가)
-- 발주번호 = customer_po_number — 고객사 PO/NO (나중에 수정 가능)

create table if not exists public.orders (
  id text primary key,
  order_date date not null default current_date,
  delivery_date date,
  customer text not null default '',
  category text not null default '양산' check (category in ('양산', '샘플', '자재')),
  source text not null default 'manual',
  source_quote_id text references public.quotations(id) on delete set null,
  note text not null default '',
  customer_po_number text not null default '',
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_id_not_blank_check check (length(trim(id)) > 0),
  constraint orders_id_length_check check (char_length(id) <= 100)
);

comment on table public.orders is '주문 마스터 — 내부 발주ID=id, 발주번호=customer_po_number';
comment on column public.orders.id is '내부 발주ID — MRO-YYMMDD-NN 또는 직접 입력 (INSERT 시 비어 있으면 자동 발급)';
comment on column public.orders.source_quote_id is '원본 견적 FK (quotations.id = MRQ-YYMMDD-NN)';
comment on column public.orders.note is '주문서 비고';
comment on column public.orders.customer_po_number is '발주번호(PO/NO) — 미입력 시 INSERT 때 발주ID(id)와 동일하게 자동 발급, 이후 수정 가능';
comment on column public.orders.created_by is '등록자 auth.users.id';
comment on column public.orders.created_by_name is '등록자 표시명 스냅샷';

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

comment on column public.order_lines.derived_from_line_id is '조립제품 주문 줄에서 BOM 펼침으로 생성된 반제품 줄 (주문 UI 비표시)';
comment on column public.order_lines.delivery_date is '제품(라인)별 납기일';

create index if not exists orders_order_date_idx on public.orders (order_date desc);
create index if not exists orders_created_at_idx on public.orders (created_at desc);
create index if not exists orders_customer_idx on public.orders (customer);
create index if not exists orders_source_quote_id_idx on public.orders (source_quote_id);
create index if not exists orders_created_by_idx on public.orders (created_by);
create index if not exists orders_customer_po_number_idx
  on public.orders (customer_po_number)
  where customer_po_number <> '';
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

create or replace function public.generate_order_code(
  p_order_date date default (timezone('Asia/Seoul', now()))::date
)
returns text
language plpgsql
as $fn$
declare
  d date;
  prefix text;
  max_suffix integer := 0;
  row_id text;
  suffix_text text;
  suffix_num integer;
begin
  d := coalesce(p_order_date, (timezone('Asia/Seoul', now()))::date);
  prefix := 'MRO-' || to_char(d, 'YYMMDD');

  for row_id in
    select id
    from public.orders
    where id like prefix || '-%'
       or order_date = d
  loop
    if length(row_id) = length(prefix) + 3
       and row_id like prefix || '-__' then
      suffix_text := right(row_id, 2);
      begin
        suffix_num := suffix_text::integer;
        if suffix_num > max_suffix then
          max_suffix := suffix_num;
        end if;
      exception
        when invalid_text_representation then
          null;
      end;
    end if;
  end loop;

  return prefix || '-' || lpad((max_suffix + 1)::text, 2, '0');
end;
$fn$;

grant execute on function public.generate_order_code(date) to anon, authenticated;

create or replace function public.normalize_orders_row()
returns trigger
language plpgsql
as $$
begin
  new.customer := coalesce(trim(new.customer), '');
  new.customer_po_number := coalesce(trim(new.customer_po_number), '');
  new.note := coalesce(trim(new.note), '');

  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_order_code(new.order_date);
    end if;
    -- 발주번호 미입력 → 발주ID(MRO-YYMMDD-NN)와 동일하게 자동 발급
    if new.customer_po_number = '' then
      new.customer_po_number := new.id;
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

-- 기존 DB 보강 (created_by / customer_po_number)
alter table public.orders
  add column if not exists created_by uuid references auth.users (id) on delete set null;
alter table public.orders
  add column if not exists created_by_name text not null default '';
alter table public.orders
  add column if not exists customer_po_number text not null default '';
create index if not exists orders_created_by_idx on public.orders (created_by);

comment on column public.orders.id is '발주ID — MRO-YYMMDD-NN 자동 발급 (수정 불가, FK 기준키)';
comment on column public.orders.customer_po_number is '발주번호(PO/NO) — 미입력 시 INSERT 때 발주ID(id)와 동일하게 자동 발급, 이후 수정 가능';

-- 발주번호가 비어 있으면 발주ID와 동일하게 채움 (과거 데이터)
update public.orders
set customer_po_number = id
where coalesce(trim(customer_po_number), '') = '';
create index if not exists orders_customer_po_number_idx
  on public.orders (customer_po_number)
  where customer_po_number <> '';
