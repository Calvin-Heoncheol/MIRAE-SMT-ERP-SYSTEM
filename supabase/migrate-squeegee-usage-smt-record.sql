-- 스퀴즈 사용 이력에 SMT 생산실적 FK 추가
-- Supabase SQL Editor에서 실행하세요

alter table public.squeegee_usage_logs
  add column if not exists smt_production_record_id uuid
  references public.smt_production_records(id) on delete set null;

comment on column public.squeegee_usage_logs.smt_production_record_id is '연동된 SMT 생산 실적';

create index if not exists squeegee_usage_logs_smt_record_idx
  on public.squeegee_usage_logs (smt_production_record_id);
