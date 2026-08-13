-- 주문코드 자동 발급: MRO-0001 → 고객사명 접두사-0001 (예: 서창→SC-0001, 파스텍→PST-0001)
-- Supabase SQL Editor에서 실행하세요.
-- 규칙: 한글 음절 로마자 첫글자 + 영문/숫자. 5글자 이상이면 앞 3자. 불가 시 MRO.

create or replace function public.order_code_prefix_from_customer(customer text)
returns text
language plpgsql
immutable
as $$
declare
  cho text[] := array[
    'g','kk','n','d','tt','r','m','b','pp','s','ss','',
    'j','jj','ch','k','t','p','h'
  ];
  jung text[] := array[
    'a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo',
    'u','wo','we','wi','yu','eu','ui','i'
  ];
  src text := regexp_replace(coalesce(customer, ''), '\s+', '', 'g');
  ch text;
  code integer;
  s integer;
  cho_i integer;
  jung_i integer;
  initial text;
  vowel text;
  roman text;
  letters text := '';
  prefix text;
begin
  for i in 1..char_length(src) loop
    ch := substr(src, i, 1);

    if ch ~ '[A-Za-z]' then
      letters := letters || upper(ch);
      continue;
    end if;

    if ch ~ '[0-9]' then
      letters := letters || ch;
      continue;
    end if;

    -- UTF8 환경에서 ascii() = Unicode code point
    code := ascii(ch);
    if code < 44032 or code > 55203 then
      continue;
    end if;

    s := code - 44032;
    cho_i := s / 588;
    jung_i := (s % 588) / 28;
    initial := cho[cho_i + 1];
    vowel := jung[jung_i + 1];
    roman := nullif(initial, '');
    if roman is null then
      roman := vowel;
    end if;
    if roman is null or roman = '' then
      continue;
    end if;

    letters := letters || upper(substr(roman, 1, 1));
  end loop;

  prefix := letters;
  if char_length(prefix) > 4 then
    prefix := substr(prefix, 1, 3);
  end if;

  if prefix is null or prefix = '' then
    return 'MRO';
  end if;

  return prefix;
end;
$$;

drop function if exists public.generate_order_code();

create or replace function public.generate_order_code(customer text default '')
returns text
language plpgsql
as $$
declare
  prefix text;
  max_num integer;
  next_num integer;
  pattern text;
begin
  prefix := public.order_code_prefix_from_customer(customer);
  -- prefix 는 A-Z0-9 만 포함
  pattern := '^' || prefix || '-[0-9]+$';

  select coalesce(max(
    nullif(regexp_replace(id, '^' || prefix || '-', ''), '')::integer
  ), 0)
  into max_num
  from public.orders
  where id ~ pattern;

  next_num := max_num + 1;
  return prefix || '-' || lpad(next_num::text, 4, '0');
end;
$$;

grant execute on function public.order_code_prefix_from_customer(text) to anon, authenticated;
grant execute on function public.generate_order_code(text) to anon, authenticated;

create or replace function public.normalize_orders_row()
returns trigger
language plpgsql
as $$
begin
  new.customer := coalesce(trim(new.customer), '');

  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_order_code(new.customer);
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  return new;
end;
$$;

comment on table public.orders is '주문 마스터 — 주문코드=id(고객사 PO/NO 또는 고객사접두사-0001)';
comment on column public.orders.id is '주문코드 — 고객사 PO/NO 또는 고객사접두사-0001 (INSERT 시 비어 있으면 자동 발급, 수정 불가)';
comment on function public.order_code_prefix_from_customer(text) is '고객사명 → 주문코드 접두사 (한글 음절 로마자 첫글자)';
comment on function public.generate_order_code(text) is '고객사 접두사 기준 주문코드 자동 발급 (SC-0001)';
