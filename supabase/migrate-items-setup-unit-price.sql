-- 품목 SET-UP 단가 (없으면 other_unit_price 로 호환)
alter table public.items
  add column if not exists setup_unit_price numeric not null default 0;

comment on column public.items.setup_unit_price is
  'SET-UP 전체 비용 — 발주 시 1회 청구 (대당 아님)';

-- unit_price는 대당 합계(SMD+후공정)만 유지 (SET-UP·자재 제외)
update public.items
set unit_price = coalesce(smd_unit_price, 0) + coalesce(dip_unit_price, 0)
where item_category in (3, 4)
  and (coalesce(smd_unit_price, 0) + coalesce(dip_unit_price, 0)) > 0;
