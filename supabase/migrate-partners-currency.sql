-- 거래처별 기본 통화 (KRW / USD) — 발주서·구매발주 기본값
-- Supabase SQL Editor에서 실행하세요.

alter table public.business_partners
  add column if not exists currency text not null default 'KRW';

alter table public.business_partners drop constraint if exists business_partners_currency_check;
alter table public.business_partners
  add constraint business_partners_currency_check
  check (currency in ('KRW', 'USD'));

comment on column public.business_partners.currency is '발주서·구매발주 기본 통화: KRW / USD';

-- 적용 이력 기록 (setup-schema-migrations.sql 실행 후에만 기록됨)
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    insert into public.schema_migrations (filename) values ('migrate-partners-currency.sql') on conflict do nothing;
  end if;
end $$;
