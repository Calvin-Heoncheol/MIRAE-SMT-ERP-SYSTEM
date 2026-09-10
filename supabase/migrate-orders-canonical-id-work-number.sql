-- =============================================================================
-- 정본: 발주ID + 작업번호
-- =============================================================================
-- 발주ID: {고객사접두}-YYMMDD-NN
--   → 먼저 migrate-orders-customer-yymmdd-id.sql 적용 (미적용 시)
-- 작업번호: {발주번호|발주ID}-NN
--   → 앱 reassignOrderWorkNumbers 가 저장 시 부여. 본 파일은 기존 데이터 백필.
--
-- save_order_* 는 work_number 를 쓰지 않음 (migrate-order-lines-price-breakdown.sql).
-- 구버전 migrate-order-lines-work-number.sql 의 {접두}-YYMMDD-NN 형식은 deprecated.
-- =============================================================================

-- 작업번호 데이터 백필: {PO|orderId}-{NN}
WITH ranked AS (
  SELECT
    ol.id AS line_id,
    coalesce(nullif(btrim(o.customer_po_number), ''), o.id) AS work_base,
    row_number() OVER (
      PARTITION BY o.id
      ORDER BY ol.line_seq ASC NULLS LAST, ol.id ASC
    ) AS rn
  FROM public.order_lines ol
  JOIN public.orders o ON o.id = ol.order_id
  WHERE ol.product_id IS NOT NULL
    AND ol.derived_from_line_id IS NULL
)
UPDATE public.order_lines ol
SET work_number = ranked.work_base || '-' || lpad(ranked.rn::text, 2, '0')
FROM ranked
WHERE ol.id = ranked.line_id;

UPDATE public.order_lines AS child
SET work_number = parent.work_number
FROM public.order_lines AS parent
WHERE child.derived_from_line_id = parent.id
  AND parent.work_number IS NOT NULL
  AND btrim(parent.work_number) <> '';

UPDATE public.order_lines
SET work_number = NULL
WHERE derived_from_line_id IS NULL
  AND product_id IS NULL
  AND work_number IS NOT NULL;

COMMENT ON COLUMN public.order_lines.work_number IS
  '작업번호 — {발주번호}-{순번} (발주번호=고객PO 우선, 없으면 내부 발주ID). 추가작업(금액전용)은 null. 앱 reassignOrderWorkNumbers 가 정본.';

COMMENT ON COLUMN public.orders.id IS
  '발주ID — {고객사접두}-YYMMDD-NN 자동 발급 (migrate-orders-customer-yymmdd-id.sql)';
