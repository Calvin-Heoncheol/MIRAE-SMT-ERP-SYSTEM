-- 작업번호 형식: {발주번호}-{NN}
-- 발주번호 = customer_po_number(있으면) 또는 내부 발주ID(orders.id)
-- UI 제품행(파생 아님)만 일련 부여, 반제품/추가작업 파생행은 부모와 동일 작업번호
--
-- Supabase SQL Editor에서 실행하세요.

-- 1) UI 제품행 재부여
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

-- 2) 파생행: 부모 UI행 작업번호 상속
UPDATE public.order_lines AS child
SET work_number = parent.work_number
FROM public.order_lines AS parent
WHERE child.derived_from_line_id = parent.id
  AND parent.work_number IS NOT NULL
  AND btrim(parent.work_number) <> '';

-- 3) 추가작업(금액전용, product_id null) UI행은 작업번호 없음
UPDATE public.order_lines
SET work_number = NULL
WHERE derived_from_line_id IS NULL
  AND product_id IS NULL
  AND work_number IS NOT NULL;

COMMENT ON COLUMN public.order_lines.work_number IS
  '작업번호 — {발주번호}-{순번} (예: PO123-01, LEE-260904-01-01). 발주번호=고객PO 우선, 없으면 내부 발주ID. 추가작업(금액전용)은 null';
