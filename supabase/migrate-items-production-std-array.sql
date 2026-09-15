-- =============================================================================
-- 반제품 production_std 에 Array 필드 문서화
-- =============================================================================
-- 스키마 변경 없음 (jsonb). 앱에서 arrayCount 를 읽고 씁니다.
--
-- production_std 예:
--   {
--     "arrayCount": 4,
--     "partCount": 120,
--     "partCountTop": 80,
--     "partCountBot": 70,
--     "tactTimeSec": 45,
--     "tactTimeTopSec": 40,
--     "tactTimeBotSec": 42
--   }
--
-- arrayCount: 패널 1장 PCB 수 (장비 Tech Time이 그 패널 1회 시간)
-- tactTime*: SMT 장비 표시 Tech Time (초, 패널 1회)
-- 발주 1대당 초 = tactTime / max(arrayCount, 1)
--
-- 기존 컬럼만 있으면 실행 불필요. 코멘트만 갱신합니다.
-- =============================================================================

comment on column public.items.production_std is
  '반제품 생산 기준 — arrayCount(패널당 PCB)·종수·Tech Time(장비 패널 초). 1대당 초 = Tech Time / Array';
