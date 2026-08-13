-- 주문/견적 번호: 날짜+당일 순번
-- 주문 자동발급: 고객사접두사-0001 → MRO-YYMMDD-NN (order_date 기준)
-- 견적 자동발급: MRQ-0001 → MRQ-YYMMDD-NN (quote_date 기준)
-- 예: MRO-260811-01, MRQ-260811-01
-- 수동 입력 발주ID·기존 번호는 유지
-- Supabase SQL Editor에서 실행하세요.

-- ---------------------------------------------------------------------------
-- quotations CHECK: 구형식 + 신형식
-- ---------------------------------------------------------------------------
alter table public.quotations
  drop constraint if exists quotations_id_mrq_format_check;

alter table public.quotations
  add constraint quotations_id_mrq_format_check
  check (
    id ~ '^MRQ-[0-9]+$'
    or id ~ '^MRQ-[0-9]{6}-[0-9]{2}$'
  );

create or replace function public.generate_quote_code(
  p_quote_date date default (timezone('Asia/Seoul', now()))::date
)
returns text
language plpgsql
as $fn$
declare
  d date;
  prefix text;
  max_suffix integer := 0;
  row_id text;
  suffix_text text;
  suffix_num integer;
begin
  d := coalesce(p_quote_date, (timezone('Asia/Seoul', now()))::date);
  prefix := 'MRQ-' || to_char(d, 'YYMMDD');

  for row_id in
    select id
    from public.quotations
    where id like prefix || '-%'
       or quote_date = d
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

create or replace function public.normalize_quotations_row()
returns trigger
language plpgsql
as $fn$
begin
  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_quote_code(new.quote_date);
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  new.customer := coalesce(trim(new.customer), '');
  new.product_name := coalesce(trim(new.product_name), '');
  return new;
end;
$fn$;

comment on function public.generate_quote_code(date) is
  '견적번호 자동 발급 — MRQ-YYMMDD-NN (견적일 기준 당일 순번)';
comment on column public.quotations.id is
  '내부 견적코드 MRQ-YYMMDD-NN (INSERT 시 자동 발급). 구형식 MRQ-0001 호환';

-- 구 시그니처(generate_quote_code()) 가 남아 있으면 제거
drop function if exists public.generate_quote_code();

grant execute on function public.generate_quote_code(date) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- orders: MRO-YYMMDD-NN (비어 있을 때만)
-- ---------------------------------------------------------------------------
drop function if exists public.generate_order_code(text);

create or replace function public.generate_order_code(
  p_order_date date default (timezone('Asia/Seoul', now()))::date
)
returns text
language plpgsql
as $fn$
declare
  d date;
  prefix text;
  max_suffix integer := 0;
  row_id text;
  suffix_text text;
  suffix_num integer;
begin
  d := coalesce(p_order_date, (timezone('Asia/Seoul', now()))::date);
  prefix := 'MRO-' || to_char(d, 'YYMMDD');

  for row_id in
    select id
    from public.orders
    where id like prefix || '-%'
       or order_date = d
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

create or replace function public.normalize_orders_row()
returns trigger
language plpgsql
as $fn$
begin
  new.customer := coalesce(trim(new.customer), '');

  if tg_op = 'INSERT' then
    if new.id is null or trim(new.id) = '' then
      new.id := public.generate_order_code(new.order_date);
    end if;
  elsif tg_op = 'UPDATE' and new.id is distinct from old.id then
    new.id := old.id;
  end if;

  return new;
end;
$fn$;

grant execute on function public.generate_order_code(date) to anon, authenticated;

comment on table public.orders is
  '주문 마스터 — 주문코드=id(고객사 PO/NO 또는 MRO-YYMMDD-NN 자동)';
comment on column public.orders.id is
  '주문코드 — 고객사 PO/NO 또는 MRO-YYMMDD-NN (INSERT 시 비어 있으면 자동 발급, 수정 불가)';
comment on function public.generate_order_code(date) is
  '주문코드 자동 발급 — MRO-YYMMDD-NN (주문일 기준 당일 순번)';
comment on column public.orders.source_quote_id is
  '원본 견적 FK (quotations.id = MRQ-YYMMDD-NN)';
