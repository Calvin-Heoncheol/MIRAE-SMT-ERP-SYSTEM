-- 품목 ↔ 기준 견적 연결 (종수는견적에만 두고 품목에서 참조)
alter table public.items
  add column if not exists baseline_quote_id text;

comment on column public.items.baseline_quote_id is
  '기준 견적서 quotations.id — 종수·SET-UP 산정은 해당 견적에서 불러옴';

create index if not exists items_baseline_quote_id_idx
  on public.items (baseline_quote_id)
  where baseline_quote_id is not null;
