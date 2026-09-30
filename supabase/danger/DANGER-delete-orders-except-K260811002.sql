-- ============================================================
-- 위험: 발주번호(주문서번호) K260811002 를 제외한 주문을 전부 삭제합니다.
--
-- 함께 삭제·정리되는 데이터 (FK cascade):
--   - order_lines, order_assembly_groups, 조립그룹 라인
--   - SMT/후공정 생산 실적·계획, 출하 실적, 생산계획 보드
--   - 해당 주문의 자재 불출 전표(MROB)
--
-- 유지:
--   - customer_po_number 또는 id 가 K260811002 인 주문 1건(있으면)
--   - 품목·BOM·견적·다른 주문과 무관한 마스터
--
-- Supabase SQL Editor에서 아래 「1) 확인」만 먼저 실행 →
-- 유지 대상 1건이 맞는지 본 뒤 「2) 삭제」 블록 전체 실행.
-- ============================================================

-- ------------------------------------------------------------
-- 1) 확인 — 유지할 주문 / 지울 주문 개수
-- ------------------------------------------------------------

select
  id as 발주id,
  customer_po_number as 발주번호,
  customer as 고객사,
  order_date as 주문일
from public.orders
where trim(customer_po_number) = 'K260811002'
   or trim(id) = 'K260811002';

select count(*) as 삭제_예정_주문수
from public.orders
where trim(customer_po_number) <> 'K260811002'
  and trim(id) <> 'K260811002';

select count(*) as 삭제_예정_자재불출수
from public.material_outbound_records mor
where mor.order_id is not null
  and mor.order_id in (
    select id
    from public.orders
    where trim(customer_po_number) <> 'K260811002'
      and trim(id) <> 'K260811002'
  );

-- ------------------------------------------------------------
-- 2) 삭제 — 위 확인 후 문제 없을 때만 실행
-- ------------------------------------------------------------

begin;

-- 자재 불출: orders FK 가 restrict 이라 먼저 제거
delete from public.material_outbound_records mor
where mor.order_id is not null
  and mor.order_id in (
    select o.id
    from public.orders o
    where trim(o.customer_po_number) <> 'K260811002'
      and trim(o.id) <> 'K260811002'
  );

-- 주문 삭제 → 라인·조립그룹·생산·출하·계획 등 cascade
delete from public.orders o
where trim(o.customer_po_number) <> 'K260811002'
  and trim(o.id) <> 'K260811002';

commit;

-- ------------------------------------------------------------
-- 3) 결과 확인
-- ------------------------------------------------------------

select
  id as 발주id,
  customer_po_number as 발주번호,
  customer as 고객사,
  order_date as 주문일
from public.orders
order by order_date desc, id;

select count(*) as 남은_주문수 from public.orders;
