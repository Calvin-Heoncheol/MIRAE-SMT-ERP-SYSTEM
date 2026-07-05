-- Supabase SQL Editor에서 실행하세요 (setup-orders.sql 이후)
--
-- 내부 제품코드 = id (MRP-0001, MRP-0002 … 자동 발급)
-- product_name: 화면·주문 표시명 (Amigo main, Amigo p60A 등)
-- product_kind: pcb=반제품, assembly=완제품

create table if not exists public.products (
  id text primary key,
  customer text not null default '',
  product_name text not null default '',
  default_unit_price numeric not null default 0 check (default_unit_price >= 0),
  pcb_side_mode text not null default 'single' check (pcb_side_mode in ('single', 'dual')),
  product_kind text not null default 'pcb' check (product_kind in ('pcb', 'assembly')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.products is '제품 마스터 — 내부코드=id(MRP-0001)';
comment on column public.products.id is '내부 제품코드 MRP-0001 (INSERT 시 자동 발급, 수정 불가)';
comment on column public.products.customer is '고객사';
comment on column public.products.product_name is '제품명 (버전 포함)';
comment on column public.products.default_unit_price is '기본 단가';
comment on column public.products.pcb_side_mode is 'SMT 면구분: single=단면, dual=양면 (반제품만)';
comment on column public.products.product_kind is 'pcb=반제품(SMT), assembly=완제품';
comment on column public.products.is_active is '사용 여부';

create index if not exists products_customer_idx on public.products (customer);
create index if not exists products_product_name_idx on public.products (product_name);
create index if not exists products_is_active_idx on public.products (is_active);
create index if not exists products_product_kind_idx on public.products (product_kind);

alter table public.products enable row level security;

drop policy if exists "products public read" on public.products;
create policy "products public read" on public.products for select using (true);

drop policy if exists "products public insert" on public.products;
create policy "products public insert" on public.products for insert with check (true);

drop policy if exists "products public update" on public.products;
create policy "products public update" on public.products for update using (true) with check (true);

drop policy if exists "products public delete" on public.products;
create policy "products public delete" on public.products for delete using (true);

create or replace function public.touch_products_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_product_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRP-', ''), '')::integer
  ), 0)
  into max_num
  from public.products
  where id ~ '^MRP-[0-9]+$';

  next_num := max_num + 1;
  return 'MRP-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_product_code() to anon, authenticated;

create or replace function public.normalize_products_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_product_code();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.customer := coalesce(trim(new.customer), '');
  new.product_name := coalesce(trim(new.product_name), '');
  new.default_unit_price := coalesce(new.default_unit_price, 0);
  new.pcb_side_mode := lower(coalesce(trim(new.pcb_side_mode), 'single'));
  if new.pcb_side_mode not in ('single', 'dual') then
    new.pcb_side_mode := 'single';
  end if;
  new.product_kind := lower(coalesce(trim(new.product_kind), 'pcb'));
  if new.product_kind not in ('pcb', 'assembly') then
    new.product_kind := 'pcb';
  end if;
  return new;
end;
$$;

drop trigger if exists products_normalize_row on public.products;
create trigger products_normalize_row
  before insert or update on public.products
  for each row
  execute function public.normalize_products_row();

drop trigger if exists products_updated_at on public.products;
create trigger products_updated_at
  before update on public.products
  for each row
  execute function public.touch_products_updated_at();

alter table public.order_lines
  add column if not exists product_id text references public.products(id) on delete set null;

alter table public.order_lines
  add column if not exists derived_from_line_id uuid references public.order_lines(id) on delete cascade;

create index if not exists order_lines_product_id_idx on public.order_lines (product_id);

create unique index if not exists order_lines_derived_parent_product_unique_idx
  on public.order_lines (derived_from_line_id, product_id)
  where derived_from_line_id is not null;

comment on column public.order_lines.product_id is '제품 FK (products.id = MRP-0001)';
comment on column public.order_lines.product_code is 'products.id 복사본 (조회 편의)';
comment on column public.order_lines.derived_from_line_id is '완제품 주문 줄에서 BOM 펼침으로 생성된 반제품 줄 (주문 UI 비표시)';
