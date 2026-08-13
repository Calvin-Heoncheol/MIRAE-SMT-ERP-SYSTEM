-- 거래처 마스터: 사업자번호 PK → 내부 ID(BP-00001) PK
-- 사업자번호는 수정 가능한 일반 컬럼(유니크)으로 유지합니다.
-- 품목 고객사 FK는 사업자번호 변경 시 함께 갱신됩니다 (ON UPDATE CASCADE).
-- Supabase SQL Editor에서 실행하세요.

create sequence if not exists public.partner_id_seq;

create or replace function public.generate_partner_id()
returns text
language plpgsql
as $$
declare
  next_num bigint;
  candidate text;
begin
  loop
    next_num := nextval('public.partner_id_seq');
    candidate := 'BP-' || lpad(next_num::text, 5, '0');
    exit when not exists (
      select 1 from public.business_partners where id = candidate
    );
  end loop;
  return candidate;
end;
$$;

grant execute on function public.generate_partner_id() to anon, authenticated;

alter table public.business_partners add column if not exists id text;

update public.business_partners
set id = public.generate_partner_id()
where id is null or btrim(id) = '';

do $$
declare
  pk_cols text;
begin
  select string_agg(a.attname, ',' order by array_position(i.indkey, a.attnum))
  into pk_cols
  from pg_index i
  join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any (i.indkey)
  where i.indrelid = 'public.business_partners'::regclass
    and i.indisprimary;

  if pk_cols is distinct from 'id' then
    if to_regclass('public.items') is not null then
      alter table public.items drop constraint if exists items_customer_reg_no_fkey;
    end if;

    alter table public.business_partners drop constraint if exists business_partners_pkey;
    alter table public.business_partners alter column id set not null;
    alter table public.business_partners add primary key (id);
  end if;
end;
$$;

-- 품목 FK가 사업자번호 유니크를 참조하므로 인덱스 교체 전에 제거
do $$
begin
  if to_regclass('public.items') is not null then
    alter table public.items drop constraint if exists items_customer_reg_no_fkey;
  end if;
end;
$$;

drop index if exists public.business_partners_business_reg_no_uidx;
create unique index if not exists business_partners_business_reg_no_uidx
  on public.business_partners (business_reg_no)
  where business_reg_no <> '';

comment on table public.business_partners is '거래처 마스터 — 내부 PK=id(BP-00001), 사업자번호는 별도 컬럼';
comment on column public.business_partners.id is '내부 거래처 PK. 저장 시 BP-00001 형식으로 자동 발급, 이후 변경 불가';
comment on column public.business_partners.business_reg_no is '사업자번호 (숫자, 선택, 수정 가능)';

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

do $$
begin
  if to_regclass('public.items') is null then
    return;
  end if;
  alter table public.items add column if not exists customer_id text;
  update public.items i
  set customer_id = p.id
  from public.business_partners p
  where coalesce(i.customer_id, '') = ''
    and coalesce(i.customer_reg_no, '') <> ''
    and i.customer_reg_no = p.business_reg_no;
  alter table public.items drop constraint if exists items_customer_reg_no_fkey;
  alter table public.items drop constraint if exists items_customer_id_fkey;
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
end;
$$;
