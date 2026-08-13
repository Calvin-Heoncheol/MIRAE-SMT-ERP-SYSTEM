-- 거래처 사업장 주소 (거래명세서 공급받는자 주소)
-- Supabase SQL Editor에서 실행하세요.

alter table public.business_partners
  add column if not exists address text not null default '';

comment on column public.business_partners.address is '사업장 주소 (거래명세서 공급받는자 주소)';

create or replace function public.normalize_business_partner_row()
returns trigger
language plpgsql
as $$
begin
  if tg_op = 'INSERT' then
    new.id := coalesce(trim(new.id), '');
    if new.id = '' or new.id !~ '^BP-[0-9]{5,}$' then
      new.id := public.generate_partner_id();
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.business_reg_no := regexp_replace(coalesce(trim(new.business_reg_no), ''), '[^0-9]', '', 'g');
  new.name := coalesce(trim(new.name), '');
  new.representative_name := coalesce(trim(new.representative_name), '');
  new.business_type := coalesce(trim(new.business_type), '');
  new.address := coalesce(trim(new.address), '');
  new.phone := coalesce(trim(new.phone), '');
  new.trade_role := lower(coalesce(trim(new.trade_role), 'both'));
  if new.trade_role not in ('purchase', 'sales', 'both') then
    new.trade_role := 'both';
  end if;

  if new.name = '' then
    raise exception '거래처명은 필수입니다.';
  end if;

  return new;
end;
$$;

drop trigger if exists business_partners_normalize_row on public.business_partners;
create trigger business_partners_normalize_row
  before insert or update on public.business_partners
  for each row
  execute function public.normalize_business_partner_row();
