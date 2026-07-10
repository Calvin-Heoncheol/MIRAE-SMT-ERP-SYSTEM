-- Supabase SQL Editor에서 실행하세요
--
-- 거래처 마스터 — 사업자번호가 PK(거래처 식별자)

create table if not exists public.business_partners (
  business_reg_no text primary key,
  name text not null default '',
  representative_name text not null default '',
  business_type text not null default '',
  phone text not null default '',
  trade_role text not null default 'both' check (trade_role in ('purchase', 'sales', 'both')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.business_partners is '거래처 마스터 — 사업자번호 PK';
comment on column public.business_partners.business_reg_no is '사업자번호 (거래처 식별자, 숫자 10자리)';
comment on column public.business_partners.name is '거래처명';
comment on column public.business_partners.representative_name is '대표자명';
comment on column public.business_partners.business_type is '업태';
comment on column public.business_partners.phone is '전화';
comment on column public.business_partners.trade_role is 'purchase=매입, sales=매출, both=매입/매출';

create index if not exists business_partners_name_idx on public.business_partners (name);
create index if not exists business_partners_trade_role_idx on public.business_partners (trade_role);
create index if not exists business_partners_is_active_idx on public.business_partners (is_active);

alter table public.business_partners enable row level security;

drop policy if exists "business_partners public read" on public.business_partners;
create policy "business_partners public read"
  on public.business_partners for select using (true);

drop policy if exists "business_partners public insert" on public.business_partners;
create policy "business_partners public insert"
  on public.business_partners for insert with check (true);

drop policy if exists "business_partners public update" on public.business_partners;
create policy "business_partners public update"
  on public.business_partners for update using (true) with check (true);

drop policy if exists "business_partners public delete" on public.business_partners;
create policy "business_partners public delete"
  on public.business_partners for delete using (true);

create or replace function public.touch_business_partners_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.normalize_business_partner_row()
returns trigger
language plpgsql
as $$
begin
  new.business_reg_no := regexp_replace(coalesce(trim(new.business_reg_no), ''), '[^0-9]', '', 'g');
  new.name := coalesce(trim(new.name), '');
  new.representative_name := coalesce(trim(new.representative_name), '');
  new.business_type := coalesce(trim(new.business_type), '');
  new.phone := coalesce(trim(new.phone), '');
  new.trade_role := lower(coalesce(trim(new.trade_role), 'both'));
  if new.trade_role not in ('purchase', 'sales', 'both') then
    new.trade_role := 'both';
  end if;

  if new.business_reg_no = '' then
    raise exception '사업자번호는 필수입니다.';
  end if;
  if new.name = '' then
    raise exception '거래처명은 필수입니다.';
  end if;

  if tg_op = 'UPDATE' and new.business_reg_no is distinct from old.business_reg_no then
    new.business_reg_no := old.business_reg_no;
  end if;

  return new;
end;
$$;

drop trigger if exists business_partners_normalize_row on public.business_partners;
create trigger business_partners_normalize_row
  before insert or update on public.business_partners
  for each row
  execute function public.normalize_business_partner_row();

drop trigger if exists business_partners_updated_at on public.business_partners;
create trigger business_partners_updated_at
  before update on public.business_partners
  for each row
  execute function public.touch_business_partners_updated_at();
