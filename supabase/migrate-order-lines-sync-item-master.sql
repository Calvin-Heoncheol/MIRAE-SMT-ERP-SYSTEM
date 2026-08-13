-- 주문 라인 스냅샷(product_name / product_code)을 현재 품목(items) 마스터와 맞춤
-- product_code 는 표시용 base_code, product_id 는 버전 행(items.id)
-- 생산관리 카드·주문목록 등이 구 명칭을 보이지 않도록 백필 (멱등)

update public.order_lines as ol
set
  product_name = i.name,
  product_code = coalesce(nullif(btrim(i.base_code), ''), i.id)
from public.items as i
where ol.product_id = i.id
  and (
    ol.product_name is distinct from i.name
    or ol.product_code is distinct from coalesce(nullif(btrim(i.base_code), ''), i.id)
  );

-- product_id 가 비어 있고 product_code 가 items.id 와 일치하는 레거시 라인
update public.order_lines as ol
set
  product_id = i.id,
  product_name = i.name,
  product_code = coalesce(nullif(btrim(i.base_code), ''), i.id)
from public.items as i
where (ol.product_id is null or btrim(ol.product_id) = '')
  and btrim(ol.product_code) <> ''
  and ol.product_code = i.id
  and (
    ol.product_name is distinct from i.name
    or ol.product_code is distinct from coalesce(nullif(btrim(i.base_code), ''), i.id)
    or ol.product_id is distinct from i.id
  );
