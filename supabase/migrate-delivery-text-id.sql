-- Supabase SQL Editor에서 실행하세요
-- 기존 delivery_records(id uuid) 테이블을 출하번호(text) PK 로 교체합니다.
-- ※ 기존 출하 데이터가 있으면 삭제됩니다.

drop view if exists public.delivery_totals cascade;
drop trigger if exists delivery_records_set_id on public.delivery_records;
drop table if exists public.delivery_records cascade;
drop function if exists public.delivery_records_set_id() cascade;
drop function if exists public.generate_delivery_number(date) cascade;

-- setup-delivery-production.sql 전체를 이어서 실행하세요.
