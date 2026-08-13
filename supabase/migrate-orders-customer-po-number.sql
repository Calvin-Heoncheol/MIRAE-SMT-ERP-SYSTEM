-- 주문서: 발주번호(PO/NO) — 내부 발주ID(orders.id)와 분리
-- Supabase SQL Editor에서 실행하세요.
-- 발주ID는 항상 MRO-YYMMDD-NN 자동 발급. 발주번호는 나중에 입력·수정 가능.

alter table public.orders
  add column if not exists customer_po_number text not null default '';

comment on column public.orders.customer_po_number is '발주번호(PO/NO) — 내부 발주ID(id)와 별도, 수정 가능';
comment on column public.orders.id is '발주ID — MRO-YYMMDD-NN 자동 발급 (수정 불가, FK 기준키)';

-- 과거 데이터: 발주번호가 비어 있으면 발주ID와 동일하게 채움
update public.orders
set customer_po_number = id
where coalesce(trim(customer_po_number), '') = '';

create index if not exists orders_customer_po_number_idx
  on public.orders (customer_po_number)
  where customer_po_number <> '';

-- save_order_update / save_order_create 에 customer_po_number 반영
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
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if coalesce(trim(p_order_id), '') = '' then
    raise exception 'ORDER_ID_REQUIRED';
  end if;

  perform 1 from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'ORDER_NOT_FOUND:%', p_order_id;
  end if;

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

  delete from public.order_lines where order_id = p_order_id;

  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      insert into public.order_lines (
        order_id,
        line_seq,
        product_id,
        product_code,
        product_name,
        quantity,
        unit_price,
        order_amount,
        delivery_date
      ) values (
        p_order_id,
        v_seq,
        nullif(trim(v_line ->> 'product_id'), ''),
        coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
        coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
        greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
        round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
        round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
        nullif(trim(v_line ->> 'delivery_date'), '')::date
      );
      v_seq := v_seq + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'orderId', p_order_id, 'lineCount', v_seq);
end;
$$;

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
  v_line jsonb;
  v_seq integer := 0;
  v_explicit_id text := nullif(trim(p_header ->> 'id'), '');
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if v_explicit_id is not null then
    if exists (select 1 from public.orders where id = v_explicit_id) then
      raise exception 'ORDER_CODE_TAKEN:%', v_explicit_id;
    end if;

    insert into public.orders (
      id, order_date, delivery_date, customer, category, source, source_quote_id, note, customer_po_number
    ) values (
      v_explicit_id,
      coalesce(nullif(trim(p_header ->> 'order_date'), '')::date, current_date),
      nullif(trim(p_header ->> 'delivery_date'), '')::date,
      coalesce(nullif(trim(p_header ->> 'customer'), ''), ''),
      coalesce(nullif(trim(p_header ->> 'category'), ''), ''),
      coalesce(nullif(trim(p_header ->> 'source'), ''), 'manual'),
      nullif(trim(p_header ->> 'source_quote_id'), ''),
      coalesce(p_header ->> 'note', ''),
      coalesce(p_header ->> 'customer_po_number', '')
    )
    returning id into v_order_id;
  else
    insert into public.orders (
      order_date, delivery_date, customer, category, source, source_quote_id, note, customer_po_number
    ) values (
      coalesce(nullif(trim(p_header ->> 'order_date'), '')::date, current_date),
      nullif(trim(p_header ->> 'delivery_date'), '')::date,
      coalesce(nullif(trim(p_header ->> 'customer'), ''), ''),
      coalesce(nullif(trim(p_header ->> 'category'), ''), ''),
      coalesce(nullif(trim(p_header ->> 'source'), ''), 'manual'),
      nullif(trim(p_header ->> 'source_quote_id'), ''),
      coalesce(p_header ->> 'note', ''),
      coalesce(p_header ->> 'customer_po_number', '')
    )
    returning id into v_order_id;
  end if;

  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      insert into public.order_lines (
        order_id, line_seq, product_id, product_code, product_name,
        quantity, unit_price, order_amount, delivery_date
      ) values (
        v_order_id,
        v_seq,
        nullif(trim(v_line ->> 'product_id'), ''),
        coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
        coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
        greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
        round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
        round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
        nullif(trim(v_line ->> 'delivery_date'), '')::date
      );
      v_seq := v_seq + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'orderId', v_order_id, 'lineCount', v_seq);
end;
$$;

revoke all on function public.save_order_update(text, jsonb, jsonb) from public;
revoke all on function public.save_order_create(jsonb, jsonb) from public;
grant execute on function public.save_order_update(text, jsonb, jsonb) to authenticated;
grant execute on function public.save_order_create(jsonb, jsonb) to authenticated;
