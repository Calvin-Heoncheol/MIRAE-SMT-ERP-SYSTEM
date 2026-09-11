-- =============================================================================
-- 발주 라인 공정 범위 (이번 작업: SMD / 후공정 / SMD+후공정)
-- =============================================================================
-- 품목 마스터는 표준 단가(SMD·후공정·자재)를 유지하고,
-- 발주 라인에서 이번 작업 범위만 선택해 단가를 합산한다.
--
-- Supabase SQL Editor에서 한 번 실행하세요.
-- 앱은 저장 후 order_lines 를 패치하므로, RPC 전면 교체 없이도 동작합니다.
-- =============================================================================

alter table public.order_lines
  add column if not exists process_type text not null default 'smt_post';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'order_lines_process_type_check'
      and conrelid = 'public.order_lines'::regclass
  ) then
    alter table public.order_lines
      add constraint order_lines_process_type_check
      check (process_type in ('smt', 'post', 'smt_post'));
  end if;
end $$;

comment on column public.order_lines.process_type is
  '발주 라인 이번 작업 공정 범위 — smt=SMD, post=후공정, smt_post=SMD+후공정';

-- 기존 행: 저장된 단가 구성으로 추정
update public.order_lines
set process_type = case
  when coalesce(smd_unit_price, 0) > 0 and coalesce(dip_unit_price, 0) > 0 then 'smt_post'
  when coalesce(smd_unit_price, 0) > 0 or coalesce(setup_cost, 0) > 0 then 'smt'
  when coalesce(dip_unit_price, 0) > 0 then 'post'
  else 'smt_post'
end
where process_type is null
   or process_type not in ('smt', 'post', 'smt_post');
