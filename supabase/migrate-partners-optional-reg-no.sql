-- 거래처 사업자번호 선택 입력 + 품목 고객사 FK를 거래처ID로 전환
-- migrate-partners-internal-id.sql 을 이미 실행한 DB에서도 다시 실행해도 됩니다.
-- Supabase SQL Editor에서 실행하세요.

alter table public.business_partners
  alter column business_reg_no set default '';

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

comment on column public.business_partners.business_reg_no is '사업자번호 (숫자, 선택, 수정 가능)';

alter table public.items add column if not exists customer_id text;

update public.items i
set customer_id = p.id
from public.business_partners p
where coalesce(i.customer_id, '') = ''
  and coalesce(i.customer_reg_no, '') <> ''
  and i.customer_reg_no = p.business_reg_no;

-- 유니크 인덱스를 품목 FK가 물고 있으므로 인덱스를 바꾸기 전에 FK를 먼저 제거
alter table public.items drop constraint if exists items_customer_reg_no_fkey;
alter table public.items drop constraint if exists items_customer_id_fkey;

drop index if exists public.business_partners_business_reg_no_uidx;
create unique index if not exists business_partners_business_reg_no_uidx
  on public.business_partners (business_reg_no)
  where business_reg_no <> '';

alter table public.items
  add constraint items_customer_id_fkey
  foreign key (customer_id) references public.business_partners(id)
  on delete set null;

create index if not exists items_customer_id_idx on public.items (customer_id);

drop index if exists public.items_customer_code_version_uidx;
create unique index if not exists items_customer_code_version_uidx
  on public.items (
    coalesce(customer_id, ''),
    lower(btrim(base_code)),
    lower(btrim(version))
  );
