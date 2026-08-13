-- 거래명세서 입금(수금) 기록
-- Supabase SQL Editor에서 실행하세요.

create table if not exists public.statement_payments (
  id uuid primary key default gen_random_uuid(),
  shipment_id text not null,
  paid_date date not null,
  amount integer not null check (amount > 0),
  note text not null default '',
  created_by uuid,
  created_by_name text not null default '',
  created_at timestamptz not null default now()
);

comment on table public.statement_payments is '거래명세서(출하번호) 입금 내역';
comment on column public.statement_payments.shipment_id is '거래명세서 번호(MRS-…)';
comment on column public.statement_payments.paid_date is '실제 입금일';
comment on column public.statement_payments.amount is '입금 금액(원)';

create index if not exists statement_payments_shipment_id_idx
  on public.statement_payments (shipment_id);

create index if not exists statement_payments_paid_date_idx
  on public.statement_payments (paid_date desc);

alter table public.statement_payments enable row level security;

drop policy if exists "statement_payments public read" on public.statement_payments;
create policy "statement_payments public read"
  on public.statement_payments for select using (true);

drop policy if exists "statement_payments public insert" on public.statement_payments;
create policy "statement_payments public insert"
  on public.statement_payments for insert with check (true);

drop policy if exists "statement_payments public update" on public.statement_payments;
create policy "statement_payments public update"
  on public.statement_payments for update using (true) with check (true);

drop policy if exists "statement_payments public delete" on public.statement_payments;
create policy "statement_payments public delete"
  on public.statement_payments for delete using (true);
