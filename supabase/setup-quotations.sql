-- Supabase SQL Editor에서 실행하세요

create table if not exists public.quotations (
  id uuid primary key default gen_random_uuid(),
  quote_date date not null default current_date,
  quote_number text not null unique,
  customer text not null default '',
  product_name text not null default '',
  board_qty integer not null default 0 check (board_qty >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  detail_info jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists quotations_quote_date_idx on public.quotations (quote_date desc);
create index if not exists quotations_customer_idx on public.quotations (customer);
create index if not exists quotations_quote_number_idx on public.quotations (quote_number desc);

alter table public.quotations enable row level security;

drop policy if exists "quotations public read" on public.quotations;
create policy "quotations public read"
  on public.quotations for select
  using (true);

drop policy if exists "quotations public insert" on public.quotations;
create policy "quotations public insert"
  on public.quotations for insert
  with check (true);

drop policy if exists "quotations public update" on public.quotations;
create policy "quotations public update"
  on public.quotations for update
  using (true)
  with check (true);

drop policy if exists "quotations public delete" on public.quotations;
create policy "quotations public delete"
  on public.quotations for delete
  using (true);

-- 견적서 번호 자동 생성 (MSK26xxxx=국내 / MSQ26xxxx=해외)
create or replace function public.generate_quote_number(p_quote_type text)
returns text
language plpgsql
as $$
declare
  prefix text;
  year_short text;
  max_num integer;
  next_num integer;
begin
  year_short := to_char(current_date, 'YY');
  if p_quote_type = 'domestic' then
    prefix := 'MSK' || year_short;
  else
    prefix := 'MSQ' || year_short;
  end if;

  select coalesce(max(
    nullif(regexp_replace(quote_number, '^' || prefix, ''), '')::integer
  ), 0)
  into max_num
  from public.quotations
  where quote_number like prefix || '%';

  next_num := max_num + 1;
  return prefix || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_quote_number(text) to anon, authenticated;

-- 기존 DB에 quote_type 컬럼이 남아 있으면 아래를 한 번 실행하세요.
-- drop index if exists quotations_quote_type_idx;
-- alter table public.quotations drop column if exists quote_type;
