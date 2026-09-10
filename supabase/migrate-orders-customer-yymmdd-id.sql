-- 발주ID 자동 발급: MRO-YYMMDD-NN → 고객사접두-YYMMDD-NN
-- 예: LEE-260909-01, FAS-260909-01 (고객사 미인식 시 MRO-…)
-- 발주번호(customer_po_number) 미입력 시 발주ID와 동일하게 복사 (기존 동작 유지)
--
-- 정본. 작업번호 PO 백필은 migrate-orders-canonical-id-work-number.sql
-- Supabase SQL Editor에서 실행하세요.

-- 고객사 → 접두 (관용 매핑 + 로마자) — 없으면 생성, 있으면 동일 규칙 유지
create or replace function public.work_number_prefix_from_customer(customer text)
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
  n text;
  src text;
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
  n := lower(regexp_replace(coalesce(customer, ''), '\s+', '', 'g'));
  n := regexp_replace(n, '[()\[\]（）【】㈜]', '', 'g');
  n := regexp_replace(n, '^주식회사', '');
  n := regexp_replace(n, '주식회사$', '');
  n := regexp_replace(n, '^주', '');
  n := regexp_replace(n, '주$', '');

  if position('리텍' in n) > 0 then
    return 'LEE';
  end if;
  if position('파스텍' in n) > 0 then
    return 'FAS';
  end if;
  if position('서창' in n) > 0 then
    return 'SC';
  end if;

  src := regexp_replace(coalesce(customer, ''), '\s+', '', 'g');
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

grant execute on function public.work_number_prefix_from_customer(text) to anon, authenticated;

comment on function public.work_number_prefix_from_customer(text) is
  '고객사 접두 — 리텍→LEE, 파스텍→FAS, 서창→SC, 그 외 로마자 (발주ID/작업번호 공용)';

-- 기존 시그니처 제거 후 재생성
drop function if exists public.generate_order_code(date);
drop function if exists public.generate_order_code(text);
drop function if exists public.generate_order_code();

create or replace function public.generate_order_code(
  p_customer text default '',
  p_order_date date default (timezone('Asia/Seoul', now()))::date
)
returns text
language plpgsql
as $fn$
declare
  d date;
  cust_prefix text;
  prefix text;
  max_suffix integer := 0;
  row_id text;
  suffix_text text;
  suffix_num integer;
begin
  d := coalesce(p_order_date, (timezone('Asia/Seoul', now()))::date);
  cust_prefix := public.work_number_prefix_from_customer(p_customer);
  prefix := cust_prefix || '-' || to_char(d, 'YYMMDD');

  for row_id in
    select id
    from public.orders
    where id like prefix || '-%'
  loop
    if length(row_id) = length(prefix) + 3
       and row_id like prefix || '-__' then
      suffix_text := right(row_id, 2);
      begin
        suffix_num := suffix_text::integer;
        if suffix_num > max_suffix then
          max_suffix := suffix_num;
        end if;
      exception
        when invalid_text_representation then
          null;
      end;
    end if;
  end loop;

  return prefix || '-' || lpad((max_suffix + 1)::text, 2, '0');
end;
$fn$;

grant execute on function public.generate_order_code(text, date) to anon, authenticated;

comment on function public.generate_order_code(text, date) is
  '발주ID 자동 발급 — {고객사접두}-YYMMDD-NN (발주일·고객사 기준 당일 순번)';

create or replace function public.normalize_orders_row()
returns trigger
language plpgsql
as $$
begin
  new.customer := coalesce(trim(new.customer), '');
  new.customer_po_number := coalesce(trim(new.customer_po_number), '');
  new.note := coalesce(trim(new.note), '');

  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_order_code(new.customer, new.order_date);
    end if;
    -- 발주번호 미입력 → 발주ID와 동일하게 자동 발급
    if new.customer_po_number = '' then
      new.customer_po_number := new.id;
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  return new;
end;
$$;

comment on column public.orders.id is
  '발주ID — {고객사접두}-YYMMDD-NN 자동 발급 (수정 불가, FK 기준키)';
comment on column public.orders.customer_po_number is
  '발주번호(PO/NO) — 미입력 시 INSERT 때 발주ID(id)와 동일하게 자동 발급, 이후 수정 가능';
