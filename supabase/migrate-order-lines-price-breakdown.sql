-- 발주 라인 단가 구성: SET-UP(전체) · SMD/후공정(대당) · 자재(회차)
alter table public.order_lines
  add column if not exists setup_cost numeric not null default 0 check (setup_cost >= 0);

alter table public.order_lines
  add column if not exists smd_unit_price numeric not null default 0 check (smd_unit_price >= 0);

alter table public.order_lines
  add column if not exists dip_unit_price numeric not null default 0 check (dip_unit_price >= 0);

alter table public.order_lines
  add column if not exists material_cost numeric not null default 0 check (material_cost >= 0);

comment on column public.order_lines.setup_cost is 'SET-UP 전체 비용 (수량 무관, 1회)';
comment on column public.order_lines.smd_unit_price is 'SMD 대당 단가';
comment on column public.order_lines.dip_unit_price is '후공정 대당 단가';
comment on column public.order_lines.material_cost is '자재비 (발주 회차별 입력, 총액)';
comment on column public.order_lines.unit_price is '대당 단가 참고 (SMD+후공정, 레거시 호환)';

-- save_order_update — breakdown 컬럼 반영 (migrate-save-order-line-upsert.sql 기준)
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
  v_line_id uuid;
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

  -- 실적 있는 라인 삭제 금지 (기존 upsert 로직 유지)
  if exists (
    select 1
    from public.order_lines ol
    where ol.order_id = p_order_id
      and ol.derived_from_line_id is null
      and not exists (
        select 1
        from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as payload(line)
        where nullif(trim(payload.line ->> 'id'), '')::uuid = ol.id
      )
      and (
        exists (select 1 from public.smt_production_records r where r.order_line_id = ol.id)
        or exists (select 1 from public.smt_production_plans p where p.order_line_id = ol.id)
      )
  ) then
    raise exception 'LINE_HAS_PRODUCTION';
  end if;

  delete from public.order_lines ol
  where ol.order_id = p_order_id
    and ol.derived_from_line_id is null
    and not exists (
      select 1
      from jsonb_array_elements(coalesce(p_lines, '[]'::jsonb)) as payload(line)
      where nullif(trim(payload.line ->> 'id'), '')::uuid = ol.id
    );

  delete from public.order_lines
  where order_id = p_order_id
    and derived_from_line_id is not null;

  update public.order_lines ol
  set line_seq = sub.next_seq
  from (
    select id, row_number() over (order by line_seq, id) - 1 as next_seq
    from public.order_lines
    where order_id = p_order_id
      and derived_from_line_id is null
  ) sub
  where ol.id = sub.id;

  if p_lines is not null and jsonb_typeof(p_lines) = 'array' then
    for v_line in select * from jsonb_array_elements(p_lines)
    loop
      begin
        v_line_id := nullif(trim(v_line ->> 'id'), '')::uuid;
      exception
        when invalid_text_representation then
          v_line_id := null;
      end;

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
          product_id = nullif(trim(v_line ->> 'product_id'), ''),
          product_code = coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
          product_name = coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
          quantity = greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
          setup_cost = round(coalesce((v_line ->> 'setup_cost')::numeric, 0)),
          smd_unit_price = round(coalesce((v_line ->> 'smd_unit_price')::numeric, 0)),
          dip_unit_price = round(coalesce((v_line ->> 'dip_unit_price')::numeric, 0)),
          material_cost = round(coalesce((v_line ->> 'material_cost')::numeric, 0)),
          unit_price = round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
          order_amount = round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
          delivery_date = nullif(trim(v_line ->> 'delivery_date'), '')::date
        where id = v_line_id
          and order_id = p_order_id;
      else
        insert into public.order_lines (
          order_id,
          line_seq,
          product_id,
          product_code,
          product_name,
          quantity,
          setup_cost,
          smd_unit_price,
          dip_unit_price,
          material_cost,
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
          round(coalesce((v_line ->> 'setup_cost')::numeric, 0)),
          round(coalesce((v_line ->> 'smd_unit_price')::numeric, 0)),
          round(coalesce((v_line ->> 'dip_unit_price')::numeric, 0)),
          round(coalesce((v_line ->> 'material_cost')::numeric, 0)),
          round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
          round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
          nullif(trim(v_line ->> 'delivery_date'), '')::date
        );
      end if;

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
        order_id,
        line_seq,
        product_id,
        product_code,
        product_name,
        quantity,
        setup_cost,
        smd_unit_price,
        dip_unit_price,
        material_cost,
        unit_price,
        order_amount,
        delivery_date
      ) values (
        v_order_id,
        v_seq,
        nullif(trim(v_line ->> 'product_id'), ''),
        coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
        coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
        greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
        round(coalesce((v_line ->> 'setup_cost')::numeric, 0)),
        round(coalesce((v_line ->> 'smd_unit_price')::numeric, 0)),
        round(coalesce((v_line ->> 'dip_unit_price')::numeric, 0)),
        round(coalesce((v_line ->> 'material_cost')::numeric, 0)),
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

grant execute on function public.save_order_update(text, jsonb, jsonb) to authenticated;
grant execute on function public.save_order_create(jsonb, jsonb) to authenticated;
