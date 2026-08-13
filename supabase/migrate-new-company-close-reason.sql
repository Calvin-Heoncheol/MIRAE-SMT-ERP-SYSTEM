-- 신규업체: 종료 사유 컬럼 추가

alter table public.new_company_inquiries
  add column if not exists close_reason text not null default '';

comment on column public.new_company_inquiries.close_reason is
  '종료 사유 (상태=closed 일 때)';
