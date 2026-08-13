-- 과거 거래명세서용 출하 스텁: assembly_group_id 없이 MRS 번호만 예약
-- Supabase SQL Editor에서 실행하세요.

alter table public.delivery_records
  alter column assembly_group_id drop not null;

comment on column public.delivery_records.assembly_group_id is
  '주문 조립 그룹 FK. 과거 거래명세서 스텁은 NULL (note = legacy_statement:{orderId})';
