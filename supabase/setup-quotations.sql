-- Supabase SQL Editor에서 실행하세요
--
-- 내부 견적코드 = id (MRQ-0001, MRQ-0002 … 자동 발급)

create table if not exists public.quotations (
  id text primary key,
  quote_date date not null default current_date,
  customer text not null default '',
  product_name text not null default '',
  board_qty integer not null default 0 check (board_qty >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  detail_info jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotations_id_mrq_format_check check (id ~ '^MRQ-[0-9]+$')
);

comment on table public.quotations is '견적 마스터 — 내부코드=id(MRQ-0001)';
comment on column public.quotations.id is '내부 견적코드 MRQ-0001 (INSERT 시 자동 발급, 수정 불가)';
comment on column public.quotations.created_by is '등록자 auth.users.id';
comment on column public.quotations.created_by_name is '등록자 표시명 스냅샷 (profiles.display_name)';

create index if not exists quotations_quote_date_idx on public.quotations (quote_date desc);
create index if not exists quotations_customer_idx on public.quotations (customer);
create index if not exists quotations_created_at_idx on public.quotations (created_at desc);
create index if not exists quotations_created_by_idx on public.quotations (created_by);

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

create or replace function public.touch_quotations_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.generate_quote_code()
returns text
language plpgsql
as $$
declare
  max_num integer;
  next_num integer;
begin
  select coalesce(max(
    nullif(regexp_replace(id, '^MRQ-', ''), '')::integer
  ), 0)
  into max_num
  from public.quotations
  where id ~ '^MRQ-[0-9]+$';

  next_num := max_num + 1;
  return 'MRQ-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.generate_quote_code() to anon, authenticated;

create or replace function public.normalize_quotations_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_quote_code();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.customer := coalesce(trim(new.customer), '');
  new.product_name := coalesce(trim(new.product_name), '');
  return new;
end;
$$;

drop trigger if exists quotations_normalize_row on public.quotations;
create trigger quotations_normalize_row
  before insert or update on public.quotations
  for each row
  execute function public.normalize_quotations_row();

drop trigger if exists quotations_updated_at on public.quotations;
create trigger quotations_updated_at
  before update on public.quotations
  for each row
  execute function public.touch_quotations_updated_at();
