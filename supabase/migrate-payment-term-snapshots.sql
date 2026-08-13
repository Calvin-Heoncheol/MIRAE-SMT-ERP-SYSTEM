-- 견적·발주·출하(거래명세서)에 결제조건 스냅샷
-- 거래처 마스터를 나중에 바꿔도 과거 입금예정일이 따라가지 않게 합니다.
-- Supabase SQL Editor에서 실행하세요.

alter table public.quotations
  add column if not exists payment_term_type text not null default '',
  add column if not exists payment_deposit_percent integer not null default 0,
  add column if not exists payment_net_days integer not null default 0,
  add column if not exists payment_monthly_day integer not null default 0;

alter table public.orders
  add column if not exists payment_term_type text not null default '',
  add column if not exists payment_deposit_percent integer not null default 0,
  add column if not exists payment_net_days integer not null default 0,
  add column if not exists payment_monthly_day integer not null default 0;

alter table public.delivery_records
  add column if not exists payment_term_type text not null default '',
  add column if not exists payment_deposit_percent integer not null default 0,
  add column if not exists payment_net_days integer not null default 0,
  add column if not exists payment_monthly_day integer not null default 0;

-- 기존 건: 거래처명 → 현재 결제조건으로 1회 백필
update public.quotations q
set
  payment_term_type = p.payment_term_type,
  payment_deposit_percent = p.payment_deposit_percent,
  payment_net_days = p.payment_net_days,
  payment_monthly_day = p.payment_monthly_day
from public.business_partners p
where q.customer = p.name
  and coalesce(q.payment_term_type, '') = ''
  and coalesce(p.payment_term_type, '') <> '';

-- 발주: 원본 견적 스냅샷 우선
update public.orders o
set
  payment_term_type = q.payment_term_type,
  payment_deposit_percent = q.payment_deposit_percent,
  payment_net_days = q.payment_net_days,
  payment_monthly_day = q.payment_monthly_day
from public.quotations q
where o.source_quote_id = q.id
  and coalesce(o.payment_term_type, '') = ''
  and coalesce(q.payment_term_type, '') <> '';

update public.orders o
set
  payment_term_type = p.payment_term_type,
  payment_deposit_percent = p.payment_deposit_percent,
  payment_net_days = p.payment_net_days,
  payment_monthly_day = p.payment_monthly_day
from public.business_partners p
where o.customer = p.name
  and coalesce(o.payment_term_type, '') = ''
  and coalesce(p.payment_term_type, '') <> '';

-- 출하/거래명세서: 발주 스냅샷
update public.delivery_records d
set
  payment_term_type = o.payment_term_type,
  payment_deposit_percent = o.payment_deposit_percent,
  payment_net_days = o.payment_net_days,
  payment_monthly_day = o.payment_monthly_day
from public.order_assembly_groups g
join public.orders o on o.id = g.order_id
where d.assembly_group_id = g.id
  and coalesce(d.payment_term_type, '') = ''
  and coalesce(o.payment_term_type, '') <> '';

-- 과거 거래명세서 stub (assembly_group 없음)
update public.delivery_records d
set
  payment_term_type = o.payment_term_type,
  payment_deposit_percent = o.payment_deposit_percent,
  payment_net_days = o.payment_net_days,
  payment_monthly_day = o.payment_monthly_day
from public.orders o
where d.note = 'legacy_statement:' || o.id
  and coalesce(d.payment_term_type, '') = ''
  and coalesce(o.payment_term_type, '') <> '';

alter table public.quotations drop constraint if exists quotations_payment_term_type_check;
alter table public.quotations
  add constraint quotations_payment_term_type_check
  check (payment_term_type in ('', 'installment', 'net', 'monthly'));

alter table public.orders drop constraint if exists orders_payment_term_type_check;
alter table public.orders
  add constraint orders_payment_term_type_check
  check (payment_term_type in ('', 'installment', 'net', 'monthly'));

alter table public.delivery_records drop constraint if exists delivery_records_payment_term_type_check;
alter table public.delivery_records
  add constraint delivery_records_payment_term_type_check
  check (payment_term_type in ('', 'installment', 'net', 'monthly'));

comment on column public.quotations.payment_term_type is '결제조건 스냅샷 (거래처 마스터와 독립)';
comment on column public.orders.payment_term_type is '결제조건 스냅샷 — 견적 상속 또는 거래처 복사';
comment on column public.delivery_records.payment_term_type is '거래명세서 결제조건 스냅샷 — 발주 상속';
