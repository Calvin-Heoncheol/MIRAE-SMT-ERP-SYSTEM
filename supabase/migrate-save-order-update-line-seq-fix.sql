-- =============================================================================
-- save_order_update: line_seq 재배치 시 unique(order_id, line_seq) 충돌 방지
-- =============================================================================
-- 배경
--   일부 마이그레이션이 기존 라인을 0,1,2… 로 바로 재번호 매긴 뒤
--   payload 순서로 다시 UPDATE 하면서 (order_id, line_seq) 유니크 충돌이 납니다.
--   음수 임시값으로 비운 뒤 최종 순번을 부여하도록 보정합니다.
--
-- 앱 쪽 BOM 파생 라인 line_seq 전역 채번도 함께 수정됨 (assembly/utils.ts).
-- Supabase SQL Editor에서 한 번 실행하세요.
-- =============================================================================

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
  v_has_breakdown boolean := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_lines'
      and column_name = 'setup_cost'
  );
  v_has_work_number boolean := exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'order_lines'
      and column_name = 'work_number'
  );
  v_has_work_prefix_fn boolean := to_regprocedure('public.work_number_prefix_from_customer(text)') is not null;
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

  if v_has_work_number and v_has_work_prefix_fn then
    select
      public.work_number_prefix_from_customer(customer)
        || '-'
        || to_char(order_date, 'YYMMDD')
    into v_work_base
    from public.orders
    where id = p_order_id;
  end if;

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

  -- unique(order_id, line_seq) 충돌 회피: 음수로 임시 비움
  update public.order_lines ol
  set line_seq = -sub.rn
  from (
    select id, row_number() over (order by line_seq, id) as rn
    from public.order_lines
    where order_id = p_order_id
  ) sub
  where ol.id = sub.id;

  if v_has_work_number then
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
  end if;

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
        if v_has_breakdown then
          update public.order_lines
          set
            line_seq = v_seq,
            product_id = v_product_id,
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
        end if;
      else
        v_work_number := null;
        if v_has_work_number and v_has_work_prefix_fn and v_product_id is not null and v_work_base is not null then
          v_work_seq := v_work_seq + 1;
          v_work_number := v_work_base || '-' || lpad(v_work_seq::text, 2, '0');
        end if;

        if v_has_breakdown and v_has_work_number then
          insert into public.order_lines (
            order_id, line_seq, product_id, product_code, product_name,
            quantity, setup_cost, smd_unit_price, dip_unit_price, material_cost,
            unit_price, order_amount, delivery_date, work_number
          ) values (
            p_order_id, v_seq, v_product_id,
            coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
            coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
            greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
            round(coalesce((v_line ->> 'setup_cost')::numeric, 0)),
            round(coalesce((v_line ->> 'smd_unit_price')::numeric, 0)),
            round(coalesce((v_line ->> 'dip_unit_price')::numeric, 0)),
            round(coalesce((v_line ->> 'material_cost')::numeric, 0)),
            round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
            round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
            nullif(trim(v_line ->> 'delivery_date'), '')::date,
            v_work_number
          );
        elsif v_has_breakdown then
          insert into public.order_lines (
            order_id, line_seq, product_id, product_code, product_name,
            quantity, setup_cost, smd_unit_price, dip_unit_price, material_cost,
            unit_price, order_amount, delivery_date
          ) values (
            p_order_id, v_seq, v_product_id,
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
        elsif v_has_work_number then
          insert into public.order_lines (
            order_id, line_seq, product_id, product_code, product_name,
            quantity, unit_price, order_amount, delivery_date, work_number
          ) values (
            p_order_id, v_seq, v_product_id,
            coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
            coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
            greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
            round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
            round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
            nullif(trim(v_line ->> 'delivery_date'), '')::date,
            v_work_number
          );
        else
          insert into public.order_lines (
            order_id, line_seq, product_id, product_code, product_name,
            quantity, unit_price, order_amount, delivery_date
          ) values (
            p_order_id, v_seq, v_product_id,
            coalesce(nullif(trim(v_line ->> 'product_code'), ''), ''),
            coalesce(nullif(trim(v_line ->> 'product_name'), ''), ''),
            greatest(0, floor(coalesce((v_line ->> 'quantity')::numeric, 0))),
            round(coalesce((v_line ->> 'unit_price')::numeric, 0)),
            round(coalesce((v_line ->> 'order_amount')::numeric, 0)),
            nullif(trim(v_line ->> 'delivery_date'), '')::date
          );
        end if;
      end if;

      v_seq := v_seq + 1;
    end loop;
  end if;

  return jsonb_build_object('ok', true, 'orderId', p_order_id, 'lineCount', v_seq);
end;
$$;

revoke all on function public.save_order_update(text, jsonb, jsonb) from public;
grant execute on function public.save_order_update(text, jsonb, jsonb) to authenticated;

comment on function public.save_order_update(text, jsonb, jsonb) is
  '주문서 수정: 라인 id upsert. line_seq 는 음수 임시값 후 재부여(unique 충돌 방지).';
