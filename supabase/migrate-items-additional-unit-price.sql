-- 반제품·조립제품 추가비용 (발주 추가작업 자동 반영)
-- 기존 other_unit_price 컬럼을 추가비용으로 사용합니다.

comment on column public.items.other_unit_price is '추가비용 — 발주서 추가작업 행 자동 반영 (반제품·조립제품)';
