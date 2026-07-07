-- 품의서 카테고리 7종으로 변경 (2026-07)
-- Supabase SQL Editor에서 실행하세요.

alter table public.approvals drop constraint if exists approvals_category_check;

update public.approvals
set category = case category
  when 'raw-materials' then 'consumables'
  when 'sub-materials' then 'consumables'
  when 'equipment' then 'equipment-purchase'
  when 'facilities' then 'facility-investment'
  when 'equipment-investment' then 'equipment-purchase'
  when 'maintenance' then 'maintenance'
  when 'outsourcing' then 'general'
  when 'travel' then 'exhibition-program'
  when 'recurring' then 'general'
  when 'misc' then 'general'
  when 'general' then 'general'
  when 'consumables' then 'consumables'
  when 'equipment-purchase' then 'equipment-purchase'
  when 'facility-investment' then 'facility-investment'
  when 'duty-tax' then 'duty-tax'
  when 'exhibition-program' then 'exhibition-program'
  else 'general'
end;

alter table public.approvals
  add constraint approvals_category_check
  check (
    category in (
      'consumables',
      'equipment-purchase',
      'facility-investment',
      'maintenance',
      'duty-tax',
      'exhibition-program',
      'general'
    )
  );

comment on column public.approvals.category is '부자재/장비구입/설비투자/유지보수/관세/전시회/기타';
