-- 신규업체: 지역 컬럼 추가

alter table public.new_company_inquiries
  add column if not exists region text not null default '';

comment on column public.new_company_inquiries.region is
  '지역 (회사 소재지 등)';
