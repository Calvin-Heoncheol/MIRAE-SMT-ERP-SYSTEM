-- =============================================================================
-- 반제품 생산 기준 (종수 · Tech Time 초/대)
-- =============================================================================
-- production_std jsonb 예:
--   {
--     "partCount": 120,
--     "partCountTop": 80,
--     "partCountBot": 70,
--     "tactTimeSec": 45,
--     "tactTimeTopSec": 40,
--     "tactTimeBotSec": 42
--   }
-- 단면·더블 → partCount / tactTimeSec
-- 양면 → partCountTop/Bot · tactTimeTopSec/BotSec
--
-- Supabase SQL Editor에서 한 번 실행하세요.
-- =============================================================================

alter table public.items
  add column if not exists production_std jsonb not null default '{}'::jsonb;

comment on column public.items.production_std is
  '반제품 생산 기준 — 종수·Tech Time(초/대). 면모드에 따라 partCount 또는 TOP/BOT 사용';
