-- 견적 SET-UP 연동용 종수 스냅샷 (금액 아님 — 견적에서 공식 계산)
alter table public.items
  add column if not exists smt_quote_parts jsonb not null default '{}'::jsonb;

comment on column public.items.smt_quote_parts is
  '견적 SET-UP/실장 연동 종수: chip, icPin, bga, smtOdd, smtSpecial, smtTopCount, smtBotCount';
