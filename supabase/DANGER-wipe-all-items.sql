-- ============================================================
-- 위험: public.items 를 전부 삭제합니다.
-- 주문서 헤더/라인 글자(품명·코드 스냅샷)는 남지만
-- 품목 FK 연결은 끊기고, BOM·조립그룹·입출고 라인도 같이 지워집니다.
-- 생산·출하 카드(조립그룹에 묶인 것)도 사라질 수 있습니다.
--
-- Supabase SQL Editor에서 파일 전체를 복사해 실행하세요.
-- 실행 전 items 테이블 CSV 백업을 권장합니다.
-- ============================================================

begin;

-- BOM
delete from public.bom_items;

-- 주문 조립 구성 (후공정/출하/생산보드가 여기 cascade)
delete from public.order_assembly_group_lines;
delete from public.order_assembly_groups;

-- 자재 입·출고 라인 (items FK restrict)
delete from public.material_outbound_lines;
delete from public.material_inbound_lines;

-- 주문서 라인의 품목 연결만 끊기 (주문 자체는 유지)
update public.order_lines set product_id = null where product_id is not null;

-- 자재 발주 라인 품목 연결 끊기
update public.material_purchase_order_lines
set material_id = null
where material_id is not null;

-- 메탈마스크 품목 연결 끊기
update public.metal_mask_assets
set item_id = null
where item_id is not null;

-- 품목 마스터 삭제
delete from public.items;

-- 다음 등록이 MR-00001 부터 나가게
alter sequence public.item_id_seq restart with 1;

commit;
