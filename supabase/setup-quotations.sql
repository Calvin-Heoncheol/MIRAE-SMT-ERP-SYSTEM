-- Supabase SQL Editor에서 실행하세요
--
-- 내부 견적코드 = id (MRQ-YYMMDD-NN 자동 발급)

create table if not exists public.quotations (
  id text primary key,
  quote_date date not null default current_date,
  customer text not null default '',
  product_name text not null default '',
  board_qty integer not null default 0 check (board_qty >= 0),
  total_amount numeric not null default 0 check (total_amount >= 0),
  detail_info jsonb not null default '{}'::jsonb,
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  payment_term_type text not null default '' check (payment_term_type in ('', 'installment', 'net', 'monthly')),
  payment_deposit_percent integer not null default 0,
  payment_net_days integer not null default 0,
  payment_monthly_day integer not null default 0,
  created_by uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  updated_by uuid references auth.users (id) on delete set null,
  updated_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint quotations_id_mrq_format_check check (
    id ~ '^MRQ-[0-9]+$'
    or id ~ '^MRQ-[0-9]{6}-[0-9]{2}$'
  )
);

comment on table public.quotations is '견적 마스터 — 내부코드=id(MRQ-YYMMDD-NN)';
comment on column public.quotations.id is '내부 견적코드 MRQ-YYMMDD-NN (INSERT 시 자동 발급)';
comment on column public.quotations.status is '견적 상태: draft(미확정) / confirmed(확정)';
comment on column public.quotations.created_by is '등록자 auth.users.id';
comment on column public.quotations.created_by_name is '등록자 표시명 스냅샷 (profiles.display_name)';
comment on column public.quotations.updated_by is '최종 수정자 auth.users.id';
comment on column public.quotations.updated_by_name is '최종 수정자 표시명 스냅샷';
comment on column public.quotations.payment_term_type is '결제조건 스냅샷 (거래처 마스터와 독립)';

create index if not exists quotations_quote_date_idx on public.quotations (quote_date desc);
create index if not exists quotations_status_idx on public.quotations (status);
create index if not exists quotations_customer_idx on public.quotations (customer);
create index if not exists quotations_created_at_idx on public.quotations (created_at desc);
create index if not exists quotations_created_by_idx on public.quotations (created_by);
create index if not exists quotations_updated_by_idx on public.quotations (updated_by);

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

create or replace function public.generate_quote_code(
  p_quote_date date default (timezone('Asia/Seoul', now()))::date
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
  d := coalesce(p_quote_date, (timezone('Asia/Seoul', now()))::date);
  prefix := 'MRQ-' || to_char(d, 'YYMMDD');

  for row_id in
    select id
    from public.quotations
    where id like prefix || '-%'
       or quote_date = d
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

grant execute on function public.generate_quote_code(date) to anon, authenticated;

create or replace function public.normalize_quotations_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_quote_code(new.quote_date);
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

alter table public.quotations
  add column if not exists payment_term_type text not null default '',
  add column if not exists payment_deposit_percent integer not null default 0,
  add column if not exists payment_net_days integer not null default 0,
  add column if not exists payment_monthly_day integer not null default 0;
alter table public.quotations drop constraint if exists quotations_payment_term_type_check;
alter table public.quotations
  add constraint quotations_payment_term_type_check
  check (payment_term_type in ('', 'installment', 'net', 'monthly'));
