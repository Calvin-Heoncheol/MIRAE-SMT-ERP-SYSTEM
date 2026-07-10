-- Supabase SQL Editor에서 실행하세요
-- ERP 관련 테이블·뷰 전체 삭제 (데이터 초기화)
-- 실행 후 setup-*.sql 을 순서대로 다시 실행합니다.

drop view if exists public.smt_production_totals cascade;
drop view if exists public.post_process_production_totals cascade;
drop view if exists public.delivery_totals cascade;
drop view if exists public.order_assembly_group_detail cascade;
drop view if exists public.bom_detail cascade;

drop table if exists public.material_inbound_lines cascade;
drop table if exists public.material_inbound_records cascade;
drop table if exists public.material_purchase_order_lines cascade;
drop table if exists public.material_purchase_orders cascade;
drop table if exists public.smt_production_records cascade;
drop table if exists public.post_process_production_records cascade;
drop table if exists public.delivery_records cascade;
drop table if exists public.order_assembly_group_lines cascade;
drop table if exists public.order_assembly_groups cascade;
drop table if exists public.bom_items cascade;
drop table if exists public.order_lines cascade;
drop table if exists public.orders cascade;
drop table if exists public.approvals cascade;
drop table if exists public.quotations cascade;
drop table if exists public.items cascade;
drop table if exists public.products cascade;
drop table if exists public.material_mpns cascade;
drop table if exists public.materials cascade;

drop function if exists public.generate_material_inbound_code() cascade;
drop function if exists public.generate_material_purchase_order_code() cascade;
drop function if exists public.generate_product_code() cascade;
drop function if exists public.generate_material_code() cascade;
drop function if exists public.normalize_items_row() cascade;
drop function if exists public.touch_items_updated_at() cascade;
drop function if exists public.generate_approval_doc_number() cascade;
drop function if exists public.generate_approval_doc_number(date) cascade;
drop function if exists public.generate_approval_doc_number(date, text) cascade;
drop function if exists public.generate_approval_doc_prefix(text) cascade;
drop function if exists public.generate_approval_code() cascade;
drop function if exists public.generate_quote_code() cascade;
drop function if exists public.generate_order_code() cascade;
drop function if exists public.generate_order_number() cascade;
drop function if exists public.generate_quote_number(text) cascade;
drop function if exists public.generate_delivery_number(date) cascade;
drop function if exists public.delivery_records_set_id() cascade;
