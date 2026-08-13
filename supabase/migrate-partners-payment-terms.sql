-- 거래처 결제조건 (지급 시점 3종: 분할 / 일반 후불 / 월괄 후불)
-- Supabase SQL Editor에서 실행하세요.

alter table public.business_partners
  add column if not exists payment_term_type text not null default '',
  add column if not exists payment_deposit_percent integer not null default 0,
  add column if not exists payment_net_days integer not null default 0,
  add column if not exists payment_monthly_day integer not null default 0;

update public.business_partners
set payment_term_type = ''
where payment_term_type = 'prepay';

alter table public.business_partners drop constraint if exists business_partners_payment_term_type_check;
alter table public.business_partners
  add constraint business_partners_payment_term_type_check
  check (payment_term_type in ('', 'installment', 'net', 'monthly'));

comment on column public.business_partners.payment_term_type is '결제조건: installment=분할 지급, net=일반 후불, monthly=월괄 후불';
comment on column public.business_partners.payment_deposit_percent is '분할 지급 선금 % (1~99)';
comment on column public.business_partners.payment_net_days is '일반 후불 Net 일수';
comment on column public.business_partners.payment_monthly_day is '월괄 후불 익월 입금일 (1~31)';

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

  new.payment_term_type := lower(coalesce(trim(new.payment_term_type), ''));
  if new.payment_term_type not in ('', 'installment', 'net', 'monthly') then
    new.payment_term_type := '';
  end if;
  new.payment_deposit_percent := greatest(0, coalesce(new.payment_deposit_percent, 0));
  new.payment_net_days := greatest(0, coalesce(new.payment_net_days, 0));
  new.payment_monthly_day := greatest(0, coalesce(new.payment_monthly_day, 0));

  if new.payment_term_type = 'installment' then
    if new.payment_deposit_percent < 1 or new.payment_deposit_percent > 99 then
      new.payment_deposit_percent := 30;
    end if;
    new.payment_net_days := 0;
    new.payment_monthly_day := 0;
  elsif new.payment_term_type = 'net' then
    if new.payment_net_days < 1 then
      new.payment_net_days := 30;
    end if;
    new.payment_deposit_percent := 0;
    new.payment_monthly_day := 0;
  elsif new.payment_term_type = 'monthly' then
    if new.payment_monthly_day < 1 or new.payment_monthly_day > 31 then
      new.payment_monthly_day := 15;
    end if;
    new.payment_deposit_percent := 0;
    new.payment_net_days := 0;
  else
    new.payment_deposit_percent := 0;
    new.payment_net_days := 0;
    new.payment_monthly_day := 0;
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
