-- 공정별 분리 청구 코드
-- 고객사가 한 제품을 SMD 코드 / 후공정 코드로 나눠 관리할 때 사용합니다.
-- 생산·자재·출하는 품목 하나로 관리하고, 견적서·발주서 PDF·거래명세서에서만 두 줄로 나눠 출력합니다.
-- 두 칸 모두 입력된 품목만 분리 출력합니다.
-- Supabase SQL Editor에서 실행하세요.

alter table public.items
  add column if not exists smd_billing_code text not null default '';

alter table public.items
  add column if not exists post_billing_code text not null default '';

comment on column public.items.smd_billing_code is '공정별 분리 청구 — SMD 줄 고객 품목코드';
comment on column public.items.post_billing_code is '공정별 분리 청구 — 후공정 줄 고객 품목코드';

-- 적용 이력 기록 (setup-schema-migrations.sql 실행 후에만 기록됨)
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    insert into public.schema_migrations (filename) values ('migrate-items-process-billing-codes.sql') on conflict do nothing;
  end if;
end $$;
