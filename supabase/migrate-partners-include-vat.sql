-- 거래처별 부가세(VAT) 포함 여부 — 견적서·거래명세서 기본값
-- Supabase SQL Editor에서 실행하세요.

alter table public.business_partners
  add column if not exists include_vat boolean not null default false;

comment on column public.business_partners.include_vat is '견적서·거래명세서 부가세(10%) 포함 여부';
