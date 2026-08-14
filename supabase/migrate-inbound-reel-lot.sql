-- 입고 라인에 릴 LOT를 남긴다. 스캔한 릴을 구분하기 위함.
-- Supabase SQL Editor에서 실행하세요.

alter table public.material_inbound_lines
  add column if not exists lot_number text not null default '';

alter table public.material_inbound_lines
  add column if not exists scan_fingerprint text not null default '';

comment on column public.material_inbound_lines.lot_number is '릴 LOT. 바코드 제조 LOT 또는 MRL-YYMMDD-NNNN';
comment on column public.material_inbound_lines.scan_fingerprint is '같은 릴 재스캔 방지용 지문(시리얼·바코드)';

create index if not exists material_inbound_lines_lot_number_idx
  on public.material_inbound_lines (lot_number)
  where length(trim(lot_number)) > 0;
