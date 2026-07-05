-- Supabase SQL Editor에서 실행하세요
-- ERP 관련 테이블·뷰 전체 삭제 (데이터 초기화)
-- 실행 후 setup-*.sql 을 순서대로 다시 실행합니다.

drop view if exists public.smt_production_totals cascade;
drop view if exists public.post_process_production_totals cascade;
drop view if exists public.order_assembly_group_detail cascade;
drop view if exists public.semi_product_bom_detail cascade;
drop view if exists public.finished_product_bom_detail cascade;

drop table if exists public.smt_production_records cascade;
drop table if exists public.post_process_production_records cascade;
drop table if exists public.order_assembly_group_lines cascade;
drop table if exists public.order_assembly_groups cascade;
drop table if exists public.semi_product_bom_items cascade;
drop table if exists public.finished_product_bom_items cascade;
drop table if exists public.order_lines cascade;
drop table if exists public.orders cascade;
drop table if exists public.quotations cascade;
drop table if exists public.products cascade;
drop table if exists public.materials cascade;

drop function if exists public.generate_product_code() cascade;
drop function if exists public.generate_material_code() cascade;
drop function if exists public.generate_quote_code() cascade;
drop function if exists public.generate_order_code() cascade;
drop function if exists public.generate_order_number() cascade;
drop function if exists public.generate_quote_number(text) cascade;
