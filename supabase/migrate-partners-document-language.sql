-- 거래처별 견적서·발주서 PDF 언어 (ko=한국어, en=영어)
-- Supabase SQL Editor에서 실행하세요.

alter table public.business_partners
  add column if not exists document_language text not null default 'ko';

alter table public.business_partners drop constraint if exists business_partners_document_language_check;
alter table public.business_partners
  add constraint business_partners_document_language_check
  check (document_language in ('ko', 'en'));

comment on column public.business_partners.document_language is '견적서·발주서 PDF 언어: ko=한국어, en=영어';

-- 적용 이력 기록 (setup-schema-migrations.sql 실행 후에만 기록됨)
do $$
begin
  if to_regclass('public.schema_migrations') is not null then
    insert into public.schema_migrations (filename) values ('migrate-partners-document-language.sql') on conflict do nothing;
  end if;
end $$;
