-- =============================================================================
-- order_lines.work_number (작업번호) — {고객접두}-{발주일YYMMDD}-{NN}
-- =============================================================================
-- · 예: 리텍 → LEE-260904-01 / 파스텍 → FAS-260904-01
-- · 접두: 관용 매핑(리텍→LEE, 파스텍→FAS, 서창→SC) → 없으면 고객사명 로마자
-- · 발주 저장 시 생산 제품 라인(product_id 있음, 추가작업·파생 제외)에 자동 부여
-- · 한 번 부여되면 수정 시 유지 (이 마이그레이션으로 기존 값을 재작성)
-- · BOM 파생 라인은 부모 작업번호를 상속
-- Supabase SQL Editor에서 실행하세요.
-- =============================================================================

alter table public.order_lines
  add column if not exists work_number text;

comment on column public.order_lines.work_number is
  '작업번호 — {고객접두}-{발주일YYMMDD}-{순번} (예: LEE-260904-01). 추가작업(금액전용)은 null';

create index if not exists order_lines_work_number_idx
  on public.order_lines (work_number)
  where work_number is not null and work_number <> '';

-- -----------------------------------------------------------------------------
-- 고객사명 → 작업번호 접두 (관용 매핑 + 로마자)
-- -----------------------------------------------------------------------------
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
  '작업번호용 고객사 접두 — 리텍→LEE, 파스텍→FAS, 서창→SC, 그 외 로마자';

-- UI 생산 라인 작업번호 — 고객접두+발주일 기준으로 (재)부여
with ranked as (
  select
    ol.id,
    public.work_number_prefix_from_customer(o.customer)
      || '-'
      || to_char(o.order_date, 'YYMMDD') as work_base,
    row_number() over (partition by ol.order_id order by ol.line_seq, ol.id) as rn
  from public.order_lines ol
  join public.orders o on o.id = ol.order_id
  where ol.product_id is not null
    and nullif(trim(ol.product_id), '') is not null
    and ol.derived_from_line_id is null
)
update public.order_lines as ol
set work_number = ranked.work_base || '-' || lpad(ranked.rn::text, 2, '0')
from ranked
where ol.id = ranked.id;

-- 파생 라인 → 부모 작업번호 상속
update public.order_lines as child
set work_number = parent.work_number
from public.order_lines as parent
where child.derived_from_line_id = parent.id
  and parent.work_number is not null
  and trim(parent.work_number) <> '';

-- -----------------------------------------------------------------------------
-- save_order_create: 작업번호 자동 부여 (고객접두+발주일)
-- -----------------------------------------------------------------------------
create or replace function public.save_order_create(
  p_header jsonb,
  p_lines jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_order_id text;
  v_work_base text;
  v_line jsonb;
  v_seq integer := 0;
  v_work_seq integer := 0;
  v_work_number text;
  v_product_id text;
  v_explicit_id text := nullif(trim(p_header ->> 'id'), '');
  v_currency text := upper(coalesce(nullif(trim(p_header ->> 'currency'), ''), 'KRW'));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if v_currency not in ('KRW', 'USD') then
    v_currency := 'KRW';
  end if;

  if v_explicit_id is not null then
    if exists (select 1 from public.orders where id = v_explicit_id) then
      raise exception 'ORDER_CODE_TAKEN:%', v_explicit_id;
    end if;

    insert into public.orders (
      id, order_date, delivery_date, customer, category, source, source_quote_id,
      note, customer_po_number, currency
    ) values (
      v_explicit_id,
      coalesce(nullif(trim(p_header ->> 'order_date'), '')::date, current_date),
      nullif(trim(p_header ->> 'delivery_date'), '')::date,
      coalesce(nullif(trim(p_header ->> 'customer'), ''), ''),
      coalesce(nullif(trim(p_header ->> 'category'), ''), ''),
      coalesce(nullif(trim(p_header ->> 'source'), ''), 'manual'),
      nullif(trim(p_header ->> 'source_quote_id'), ''),
      coalesce(p_header ->> 'note', ''),
      coalesce(p_header ->> 'customer_po_number', ''),
      v_currency
    )
    returning id into v_order_id;
  else
    insert into public.orders (
      order_date, delivery_date, customer, category, source, source_quote_id,
      note, customer_po_number, currency
    ) values (
      coalesce(nullif(trim(p_header ->> 'order_date'), '')::date, current_date),
      nullif(trim(p_header ->> 'delivery_date'), '')::date,
      coalesce(nullif(trim(p_header ->> 'customer'), ''), ''),
      coalesce(nullif(trim(p_header ->> 'category'), ''), ''),
      coalesce(nullif(trim(p_header ->> 'source'), ''), 'manual'),
      nullif(trim(p_header ->> 'source_quote_id'), ''),
      coalesce(p_header ->> 'note', ''),
      coalesce(p_header ->> 'customer_po_number', ''),
      v_currency
    )
    returning id into v_order_id;
  end if;

  select
    public.work_number_prefix_from_customer(customer)
      || '-'
      || to_char(order_date, 'YYMMDD')
  into v_work_base
  from public.orders
  where id = v_order_id;

  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      v_product_id := nullif(trim(v_line ->> 'product_id'), '');
      v_work_number := null;
      if v_product_id is not null then
        v_work_seq := v_work_seq + 1;
        v_work_number := v_work_base || '-' || lpad(v_work_seq::text, 2, '0');
      end if;

      insert into public.order_lines (
        order_id, line_seq, product_id, product_code, product_name,
        quantity, unit_price, order_amount, delivery_date, work_number
      ) values (
        v_order_id,
        v_seq,
        v_product_id,
        coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
        coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
        greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
        round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
        round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
        nullif(trim(v_line ->> 'delivery_date'), '')::date,
        v_work_number
      );
      v_seq := v_seq + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'orderId', v_order_id, 'lineCount', v_seq);
end;
$$;

-- -----------------------------------------------------------------------------
-- save_order_update: 기존 작업번호 유지, 신규 생산 라인만 발급
-- -----------------------------------------------------------------------------
create or replace function public.save_order_update(
  p_order_id text,
  p_header jsonb,
  p_lines jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_line jsonb;
  v_seq integer := 0;
  v_currency text := upper(coalesce(nullif(trim(p_header ->> 'currency'), ''), 'KRW'));
  v_line_id uuid;
  v_keep_ids uuid[] := array[]::uuid[];
  v_remove record;
  v_has_currency boolean := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'orders'
      and column_name = 'currency'
  );
  v_product_id text;
  v_work_number text;
  v_work_seq integer := 0;
  v_work_base text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if coalesce(trim(p_order_id), '') = '' then
    raise exception 'ORDER_ID_REQUIRED';
  end if;

  if v_currency not in ('KRW', 'USD') then
    v_currency := 'KRW';
  end if;

  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND:%', p_order_id;
  end if;

  if v_has_currency then
    update public.orders
    set
      order_date = coalesce(nullif(trim(p_header ->> 'order_date'), '')::date, order_date),
      delivery_date = nullif(trim(p_header ->> 'delivery_date'), '')::date,
      customer = coalesce(nullif(trim(p_header ->> 'customer'), ''), customer),
      category = coalesce(nullif(trim(p_header ->> 'category'), ''), category),
      note = coalesce(p_header ->> 'note', note),
      customer_po_number = coalesce(p_header ->> 'customer_po_number', customer_po_number),
      currency = v_currency,
      updated_at = now()
    where id = p_order_id;
  else
    update public.orders
    set
      order_date = coalesce(nullif(trim(p_header ->> 'order_date'), '')::date, order_date),
      delivery_date = nullif(trim(p_header ->> 'delivery_date'), '')::date,
      customer = coalesce(nullif(trim(p_header ->> 'customer'), ''), customer),
      category = coalesce(nullif(trim(p_header ->> 'category'), ''), category),
      note = coalesce(p_header ->> 'note', note),
      customer_po_number = coalesce(p_header ->> 'customer_po_number', customer_po_number),
      updated_at = now()
    where id = p_order_id;
  end if;

  select
    public.work_number_prefix_from_customer(customer)
      || '-'
      || to_char(order_date, 'YYMMDD')
  into v_work_base
  from public.orders
  where id = p_order_id;

  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      begin
        v_line_id := nullif(trim(v_line ->> 'id'), '')::uuid;
      exception
        when invalid_text_representation then
          v_line_id := null;
      end;
      if v_line_id is not null then
        v_keep_ids := array_append(v_keep_ids, v_line_id);
      end if;
    end loop;
  end if;

  for v_remove in
    select ol.id, ol.product_code, ol.product_name
    from public.order_lines ol
    where ol.order_id = p_order_id
      and ol.derived_from_line_id is null
      and (cardinality(v_keep_ids) = 0 or not (ol.id = any (v_keep_ids)))
  loop
    if exists (
      select 1 from public.smt_production_records r where r.order_line_id = v_remove.id
    ) or exists (
      select 1 from public.smt_production_plans p where p.order_line_id = v_remove.id
    ) then
      raise exception 'LINE_HAS_PRODUCTION:%:%',
        coalesce(nullif(v_remove.product_code, ''), v_remove.id::text),
        coalesce(nullif(v_remove.product_name, ''), '');
    end if;

    if to_regclass('public.production_plan_board_items') is not null
       and exists (
         select 1
         from public.production_plan_board_items b
         where b.order_line_id = v_remove.id
       )
    then
      raise exception 'LINE_HAS_PRODUCTION:%:%',
        coalesce(nullif(v_remove.product_code, ''), v_remove.id::text),
        coalesce(nullif(v_remove.product_name, ''), '');
    end if;
  end loop;

  delete from public.order_lines ol
  where ol.order_id = p_order_id
    and ol.derived_from_line_id is null
    and (cardinality(v_keep_ids) = 0 or not (ol.id = any (v_keep_ids)));

  delete from public.order_lines
  where order_id = p_order_id
    and derived_from_line_id is not null;

  update public.order_lines ol
  set line_seq = -sub.rn
  from (
    select id, row_number() over (order by line_seq, id) as rn
    from public.order_lines
    where order_id = p_order_id
  ) sub
  where ol.id = sub.id;

  -- 순번은 접두사와 무관하게 끝 `-NN` 기준
  select coalesce(max(
    case
      when work_number ~ '-[0-9]+$'
      then (regexp_match(work_number, '-([0-9]+)$'))[1]::integer
      else 0
    end
  ), 0)
  into v_work_seq
  from public.order_lines
  where order_id = p_order_id
    and work_number is not null;

  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      begin
        v_line_id := nullif(trim(v_line ->> 'id'), '')::uuid;
      exception
        when invalid_text_representation then
          v_line_id := null;
      end;

      v_product_id := nullif(trim(v_line ->> 'product_id'), '');

      if v_line_id is not null
         and exists (
           select 1
           from public.order_lines
           where id = v_line_id
             and order_id = p_order_id
             and derived_from_line_id is null
         )
      then
        update public.order_lines
        set
          line_seq = v_seq,
          product_id = v_product_id,
          product_code = coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
          product_name = coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
          quantity = greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
          unit_price = round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
          order_amount = round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
          delivery_date = nullif(trim(v_line ->> 'delivery_date'), '')::date
        where id = v_line_id
          and order_id = p_order_id;
      else
        v_work_number := null;
        if v_product_id is not null then
          v_work_seq := v_work_seq + 1;
          v_work_number := v_work_base || '-' || lpad(v_work_seq::text, 2, '0');
        end if;

        insert into public.order_lines (
          order_id,
          line_seq,
          product_id,
          product_code,
          product_name,
          quantity,
          unit_price,
          order_amount,
          delivery_date,
          work_number
        ) values (
          p_order_id,
          v_seq,
          v_product_id,
          coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
          coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
          greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
          round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
          round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
          nullif(trim(v_line ->> 'delivery_date'), '')::date,
          v_work_number
        );
      end if;

      v_seq := v_seq + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'orderId', p_order_id, 'lineCount', v_seq);
end;
$$;

revoke all on function public.save_order_create(jsonb, jsonb) from public;
revoke all on function public.save_order_update(text, jsonb, jsonb) from public;
grant execute on function public.save_order_create(jsonb, jsonb) to authenticated;
grant execute on function public.save_order_update(text, jsonb, jsonb) to authenticated;

comment on function public.save_order_create(jsonb, jsonb) is
  '주문서 생성 + 생산 라인 작업번호({고객접두}-{발주일}-NN) 자동 부여';
comment on function public.save_order_update(text, jsonb, jsonb) is
  '주문서 수정: 라인 id upsert. 기존 작업번호 유지, 신규 생산 라인만 고객접두+발주일로 발급.';
