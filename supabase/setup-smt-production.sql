-- Supabase SQL Editor에서 실행하세요 (setup-orders.sql, setup-products.sql 이후)
--
-- SMT 생산입력: 주문 라인별 생산 실적 기록 (GAS 「SMT생산기록」 시트 대응)

create table if not exists public.smt_production_records (
  id uuid primary key default gen_random_uuid(),
  record_date date not null default (timezone('Asia/Seoul', now()))::date,
  order_line_id uuid not null references public.order_lines(id) on delete cascade,
  line_no smallint check (line_no is null or (line_no >= 1 and line_no <= 7)),
  pcb_side text not null default 'SINGLE' check (pcb_side in ('SINGLE', 'TOP', 'BOT')),
  quantity integer not null check (quantity >= 0),
  defect_quantity integer not null default 0 check (defect_quantity >= 0),
  source text not null default 'manual' check (source in ('manual', 'line_sync')),
  note text not null default '',
  created_at timestamptz not null default now(),
  check (quantity > 0 or defect_quantity > 0)
);

comment on table public.smt_production_records is 'SMT 생산 실적 — 주문 라인별 등록 이력';
comment on column public.smt_production_records.record_date is '기록일자 (KST)';
comment on column public.smt_production_records.order_line_id is '주문 라인 FK';
comment on column public.smt_production_records.line_no is 'SMT 라인 번호 1~7 (장비 연동 시, 수동 입력은 null)';
comment on column public.smt_production_records.pcb_side is '면구분: SINGLE / TOP / BOT';
comment on column public.smt_production_records.quantity is '이번 등록 양품 수량 (불량 전용 등록 시 0)';
comment on column public.smt_production_records.defect_quantity is '이번 등록 불량 수량 (진행률·잔량 계산에 미포함)';
comment on column public.smt_production_records.source is 'manual=생산입력 화면, line_sync=라인현황 동기화';

create index if not exists smt_production_records_order_line_id_idx
  on public.smt_production_records (order_line_id);

create index if not exists smt_production_records_record_date_idx
  on public.smt_production_records (record_date desc);

create index if not exists smt_production_records_created_at_idx
  on public.smt_production_records (created_at desc);

-- 주문 라인·면구분별 누적 수량 (생산입력·대시보드 조회용)
-- 컬럼 구조 변경 시 CREATE OR REPLACE 불가 → DROP 후 재생성
drop view if exists public.smt_production_totals;

create view public.smt_production_totals as
select
  order_line_id,
  pcb_side,
  coalesce(sum(quantity), 0)::integer as total_quantity
from public.smt_production_records
group by order_line_id, pcb_side;

comment on view public.smt_production_totals is 'SMT 주문 라인·면구분별 누적 양품 수량 (defect_quantity 미포함)';

alter table public.smt_production_records enable row level security;

drop policy if exists "smt_production_records public read" on public.smt_production_records;
create policy "smt_production_records public read"
  on public.smt_production_records for select using (true);

drop policy if exists "smt_production_records public insert" on public.smt_production_records;
create policy "smt_production_records public insert"
  on public.smt_production_records for insert with check (true);

drop policy if exists "smt_production_records public update" on public.smt_production_records;
create policy "smt_production_records public update"
  on public.smt_production_records for update using (true) with check (true);

drop policy if exists "smt_production_records public delete" on public.smt_production_records;
create policy "smt_production_records public delete"
  on public.smt_production_records for delete using (true);

grant select on public.smt_production_totals to anon, authenticated;